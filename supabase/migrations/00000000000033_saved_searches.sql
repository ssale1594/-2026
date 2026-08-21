-- بحث محفوظ + تنبيهات مطابقة (saved searches with match alerts) — PLAN.md
-- §20.48 ("أبحث عن قطعة … يتواصل معه صاحبها لو ظهرت لاحقًا") and §20.29.
--
-- Closes the loop the whole site otherwise leaks: someone searches for a thing
-- that doesn't exist yet, finds nothing, and never comes back — even when it
-- appears a week later. A saved search turns that dead end into a return visit.
--
-- Matching reuses normalize_arabic() and the same pg_trgm operators as
-- search_listings (migration 6), so an alert fires on exactly what the search
-- page would have shown — "كيكه" saved matches a "كيكة" listing.

create table if not exists saved_searches (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  query text not null,
  -- Stored normalized so the trigger below never has to re-normalize per row.
  normalized_query text not null,
  category_id int references categories(id),
  neighborhood_id int references neighborhoods(id),
  created_at timestamptz default now(),
  unique (user_id, normalized_query)
);

create index if not exists idx_saved_searches_match
  on saved_searches using gin (normalized_query gin_trgm_ops);

-- Remembers which listing already alerted which saved search. Without this, any
-- later UPDATE on a published listing (a price edit, a re-approval after an
-- edit) would re-notify everyone who saved that search.
create table if not exists saved_search_matches (
  id bigserial primary key,
  saved_search_id bigint references saved_searches(id) on delete cascade not null,
  listing_id uuid references listings(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (saved_search_id, listing_id)
);

alter table saved_searches enable row level security;
alter table saved_search_matches enable row level security;

drop policy if exists "saved_searches_select_own" on saved_searches;
create policy "saved_searches_select_own" on saved_searches for select using (
  user_id = auth.uid()
);

drop policy if exists "saved_searches_insert_own" on saved_searches;
create policy "saved_searches_insert_own" on saved_searches for insert with check (
  user_id = auth.uid()
);

drop policy if exists "saved_searches_delete_own" on saved_searches;
create policy "saved_searches_delete_own" on saved_searches for delete using (
  user_id = auth.uid()
);

drop policy if exists "admin_all_saved_searches" on saved_searches;
create policy "admin_all_saved_searches" on saved_searches for all using (is_admin());

-- The match ledger is internal bookkeeping; only the trigger (definer) and
-- admins touch it.
drop policy if exists "admin_all_saved_search_matches" on saved_search_matches;
create policy "admin_all_saved_search_matches" on saved_search_matches for all using (is_admin());

-- Normalizes on insert so callers can't store an unnormalized query that would
-- silently never match.
create or replace function set_saved_search_normalized()
returns trigger as $$
begin
  new.normalized_query := normalize_arabic(new.query);
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_saved_search_normalize on saved_searches;
create trigger trg_saved_search_normalize
  before insert or update of query on saved_searches
  for each row execute function set_saved_search_normalized();

-- The matcher. Runs when a listing becomes published (not on every update), and
-- notifies each saved search that matches and hasn't been told about this
-- listing before.
create or replace function match_saved_searches()
returns trigger as $$
declare
  v_row record;
begin
  if new.status <> 'published' or old.status is not distinct from 'published' then
    return null;
  end if;

  for v_row in
    select ss.id, ss.user_id, ss.query
    from saved_searches ss
    where
      -- Filters first (cheap, indexed), fuzzy text last.
      (ss.category_id is null or ss.category_id = new.category_id)
      and (ss.neighborhood_id is null or ss.neighborhood_id = new.neighborhood_id)
      and (
        new.search_text % ss.normalized_query
        or new.search_text like '%' || ss.normalized_query || '%'
      )
      -- Don't alert a seller about their own listing.
      and ss.user_id <> new.seller_id
      and not exists (
        select 1 from saved_search_matches m
        where m.saved_search_id = ss.id and m.listing_id = new.id
      )
  loop
    insert into saved_search_matches (saved_search_id, listing_id)
    values (v_row.id, new.id)
    on conflict do nothing;

    perform notify(
      v_row.user_id,
      'saved_search_match',
      'وصل شي يطابق بحثك المحفوظ',
      v_row.query || ' — ' || new.title,
      '/listing/' || new.slug
    );
  end loop;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_match_saved_searches on listings;
create trigger trg_match_saved_searches
  after update of status on listings
  for each row execute function match_saved_searches();
