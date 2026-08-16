-- زر "أحتاج" (need requests) — the model inversion: instead of a seller
-- publishing a listing and waiting to be found, a resident publishes what they
-- need and matching local sellers answer. Repeated by 5 independent brainstorm
-- sources and ChatGPT's single strongest recommendation (PLAN.md §20.28).
--
-- Buyers stay anonymous (no account, matching the platform's "no buyer login"
-- decision in TECH.md §4) — they leave a WhatsApp number, and approved sellers
-- respond through the platform, which is what makes the response side worth
-- paying for later.

create table if not exists need_requests (
  id bigserial primary key,
  title text not null,
  description text,
  category_id int references categories(id),
  neighborhood_id int references neighborhoods(id),
  contact_whatsapp text not null,
  -- Same HMAC-of-IP shape as interaction_log (migration 16): lets us rate-limit
  -- without ever storing a raw, reversible IP address.
  visitor_hash text,
  status text not null default 'open'
    check (status in ('open', 'closed', 'rejected')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz default now()
);

create index if not exists idx_need_requests_open
  on need_requests (status, expires_at, created_at desc);
create index if not exists idx_need_requests_category on need_requests (category_id);

create table if not exists need_responses (
  id bigserial primary key,
  request_id bigint references need_requests(id) on delete cascade not null,
  seller_id uuid references sellers(id) on delete cascade not null,
  message text not null,
  created_at timestamptz default now(),
  -- One response per seller per request keeps the buyer's inbox sane and stops
  -- a seller from spamming the same request repeatedly.
  unique (request_id, seller_id)
);

create index if not exists idx_need_responses_request on need_responses (request_id);

alter table need_requests enable row level security;
alter table need_responses enable row level security;

-- anon only gets SELECT by default after migration 15 narrowed the defaults, so
-- posting a need requires an explicit INSERT grant on top of the RLS policy.
grant insert on need_requests to anon;

-- Public can read only live requests; the contact number is part of the row, so
-- an expired or rejected request stops being reachable entirely.
drop policy if exists "need_requests_select_public" on need_requests;
create policy "need_requests_select_public" on need_requests for select using (
  status = 'open' and expires_at > now()
);

drop policy if exists "need_requests_insert_public" on need_requests;
create policy "need_requests_insert_public" on need_requests for insert with check (
  status = 'open'
);

drop policy if exists "admin_all_need_requests" on need_requests;
create policy "admin_all_need_requests" on need_requests for all using (
  is_admin()
);

-- Responses are visible to the seller who wrote them and to admins. Buyers are
-- anonymous, so they can't be granted row access here — the app surfaces
-- responses to the buyer through a separate unguessable token instead.
drop policy if exists "need_responses_select_own" on need_responses;
create policy "need_responses_select_own" on need_responses for select using (
  seller_id = auth.uid()
);

-- Only an approved seller may answer, and only an open, unexpired request.
drop policy if exists "need_responses_insert_seller" on need_responses;
create policy "need_responses_insert_seller" on need_responses for insert with check (
  seller_id = auth.uid()
  and exists (
    select 1 from sellers s
    where s.id = auth.uid() and s.verification_status = 'approved'
  )
  and exists (
    select 1 from need_requests r
    where r.id = request_id and r.status = 'open' and r.expires_at > now()
  )
);

drop policy if exists "admin_all_need_responses" on need_responses;
create policy "admin_all_need_responses" on need_responses for all using (
  is_admin()
);

-- Daily cap on how many needs one visitor can post, enforced server-side so it
-- can't be bypassed by calling the API directly.
create or replace function can_post_need_request(p_visitor_hash text)
returns boolean as $$
  select count(*) < 3
  from need_requests
  where visitor_hash = p_visitor_hash
    and created_at > now() - interval '1 day';
$$ language sql security definer set search_path = public, pg_temp;
