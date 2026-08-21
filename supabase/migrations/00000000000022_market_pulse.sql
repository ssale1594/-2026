-- "نبض الزلفي" / "ماذا ينقص الزلفي؟" (market pulse) — PLAN.md §19.5, §20.7-8,
-- §20.43. What people search for, and especially what they search for and find
-- *nothing*, is the clearest signal of unmet local demand. That signal is worth
-- more than any listing count: it tells a would-be entrepreneur which business
-- the town is missing, and later it is a sellable B2B report.
--
-- Privacy: stores only the normalized query text and a result count. No IP, no
-- visitor hash, no user id — nothing that ties a search to a person.

create table if not exists search_log (
  id bigserial primary key,
  normalized_query text not null,
  results_count int not null default 0,
  category_id int references categories(id),
  created_at timestamptz default now()
);

create index if not exists idx_search_log_query on search_log (normalized_query);
create index if not exists idx_search_log_created on search_log (created_at desc);
create index if not exists idx_search_log_gaps
  on search_log (normalized_query) where results_count = 0;

alter table search_log enable row level security;

-- Write-only from the public side (like contact_clicks): visitors log searches
-- but can never read the aggregate, which is the actual product here.
grant insert on search_log to anon;

drop policy if exists "search_log_insert_public" on search_log;
create policy "search_log_insert_public" on search_log for insert with check (true);

drop policy if exists "admin_all_search_log" on search_log;
create policy "admin_all_search_log" on search_log for all using (
  is_admin()
);

-- Aggregations run as SECURITY DEFINER so the admin dashboard gets one cheap
-- round trip per report instead of pulling raw rows into the app to group them.
-- Each re-checks is_admin() itself: a definer function bypasses RLS, so without
-- this an ordinary logged-in user could call the RPC directly and read the
-- whole aggregate.
create or replace function pulse_top_searches(p_days int default 30, p_limit int default 20)
returns table (query text, searches bigint, avg_results numeric) as $$
  select
    normalized_query,
    count(*) as searches,
    round(avg(results_count), 1) as avg_results
  from search_log
  where is_admin()
    and created_at > now() - (p_days || ' days')::interval
  group by normalized_query
  order by searches desc
  limit least(p_limit, 100);
$$ language sql stable security definer set search_path = public, pg_temp;

-- The gap report: searched for repeatedly, found nothing. This is the
-- "ماذا ينقص الزلفي" list.
create or replace function pulse_demand_gaps(p_days int default 90, p_limit int default 20)
returns table (query text, searches bigint) as $$
  select
    normalized_query,
    count(*) as searches
  from search_log
  where is_admin()
    and results_count = 0
    and created_at > now() - (p_days || ' days')::interval
  group by normalized_query
  order by searches desc
  limit least(p_limit, 100);
$$ language sql stable security definer set search_path = public, pg_temp;

-- Supply/demand per category: how much is listed vs how much is being asked
-- for through the needs board.
create or replace function pulse_category_demand()
returns table (
  category_name text,
  published_listings bigint,
  open_needs bigint
) as $$
  select
    c.name_ar,
    (select count(*) from listings l where l.category_id = c.id and l.status = 'published'),
    (select count(*) from need_requests r
      where r.category_id = c.id and r.status = 'open' and r.expires_at > now())
  from categories c
  where is_admin() and c.is_active
  order by c.sort_order;
$$ language sql stable security definer set search_path = public, pg_temp;
