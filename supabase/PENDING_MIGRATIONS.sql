-- ============================================================================
-- الهجرات المعلّقة — الصقها كاملة مرة واحدة بـSQL Editor بلوحة Supabase
-- ============================================================================
-- هذا الملف مولّد آليًا بدمج ملفات supabase/migrations/ من 17 إلى 23 بالترتيب.
-- الترتيب مهم: 21 (need_requests) لازم قبل 22 لأن تقرير نبض الزلفي يقرأ منه.
--
-- كلها idempotent (تتحمل إعادة التشغيل) ما عدا ملاحظة واحدة: بيانات العرض
-- التجريبية (17) تتخطى نفسها تلقائيًا لو سبق تشغيلها.
--
-- بعد التشغيل الناجح، حدّث جدول الهجرات بـSTATUS.md من ⚠️ غير مطبّقة إلى ✅.
-- ============================================================================


-- ============================================================
-- 00000000000017_demo_seed_data
-- ============================================================

-- Demo/test data: one dummy shop seller + one home-producer seller, each with
-- one published listing, so the live site has real content to browse before
-- the first actual seller signs up. NOT real accounts — bypasses the normal
-- signup/review flow by inserting auth.users directly (fine for seed data,
-- never do this for a real seller).
--
-- ⚠️ Remove these two sellers (cascades to their listings via FK) once real
-- sellers start signing up, so demo content doesn't linger on the live site.

create extension if not exists pgcrypto;

do $$
declare
  v_dummy_shop_id uuid;
  v_home_producer_id uuid;
  v_shops_category_id int;
  v_home_producers_category_id int;
  v_neighborhood_1 int;
  v_neighborhood_2 int;
begin
  -- Skip entirely if this has already run (idempotent across SQL Editor re-runs).
  if exists (select 1 from sellers where slug = 'demo-shop') then
    return;
  end if;

  select id into v_shops_category_id from categories where slug = 'shops';
  select id into v_home_producers_category_id from categories where slug = 'home-producers';
  select id into v_neighborhood_1 from neighborhoods where slug = 'as-sadiq';
  select id into v_neighborhood_2 from neighborhoods where slug = 'al-yarmouk';

  -- Dummy shop seller
  v_dummy_shop_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_dummy_shop_id, 'authenticated', 'authenticated',
    'demo-shop@example.com', crypt('demo-not-a-real-account', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into sellers (
    id, region_id, business_name, business_type, slug, description,
    whatsapp_number, verification_status
  ) values (
    v_dummy_shop_id, 1, 'محل تجريبي — للعرض فقط', 'shop', 'demo-shop',
    'حساب تجريبي لعرض شكل الموقع قبل انضمام أول بائع حقيقي.',
    '966500000001', 'approved'
  );

  insert into listings (
    seller_id, category_id, neighborhood_id, listing_type, title, slug,
    description, price, price_negotiable, status, published_at
  ) values (
    v_dummy_shop_id, v_shops_category_id, v_neighborhood_1, 'product',
    'منتج تجريبي', 'demo-product-1',
    'إعلان تجريبي لعرض شكل صفحة المنتج قبل انضمام أول بائع حقيقي.',
    50, false, 'published', now()
  );

  -- Home-producer seller
  v_home_producer_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_home_producer_id, 'authenticated', 'authenticated',
    'demo-home-producer@example.com', crypt('demo-not-a-real-account', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into sellers (
    id, region_id, business_name, business_type, slug, description,
    whatsapp_number, verification_status
  ) values (
    v_home_producer_id, 1, 'أسرة منتجة تجريبية — للعرض فقط', 'home_producer', 'demo-home-producer',
    'حساب تجريبي لعرض شكل الموقع قبل انضمام أول أسرة منتجة حقيقية.',
    '966500000002', 'approved'
  );

  insert into listings (
    seller_id, category_id, neighborhood_id, listing_type, title, slug,
    description, price, price_negotiable, status, published_at
  ) values (
    v_home_producer_id, v_home_producers_category_id, v_neighborhood_2, 'product',
    'كيكة تجريبية', 'demo-product-2',
    'إعلان تجريبي لعرض شكل صفحة المنتج قبل انضمام أول أسرة منتجة حقيقية.',
    80, true, 'published', now()
  );
end $$;

-- ============================================================
-- 00000000000018_referrals
-- ============================================================

-- "رشّح مشروعًا" (refer-a-business) — anonymous public submissions of a shop/
-- home-producer someone knows but hasn't signed up itself. ROADMAP.md phase 2:
-- most home producers won't discover the platform on their own, so the
-- community needs a channel to bring them in.

create table referrals (
  id bigserial primary key,
  referrer_name text,
  business_name text not null,
  business_description text,
  business_whatsapp text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'dismissed')),
  created_at timestamptz default now()
);

alter table referrals enable row level security;

-- Migration 15 narrowed the default privileges for new tables to SELECT-only for
-- anon, so an RLS insert policy alone is not enough — anonymous visitors need an
-- explicit table-level INSERT grant or every submission fails with "permission
-- denied" before RLS is even consulted.
grant insert on referrals to anon;

-- Anyone (including anonymous visitors) can submit a referral; no read access
-- outside admin — same "insert-only from clients" shape as contact_clicks.
create policy "referrals_insert_public" on referrals for insert with check (true);

create policy "admin_all_referrals" on referrals for all using (
  is_admin()
);

-- admin_actions.target_id was uuid-only (fits seller/listing ids) and its check
-- constraint didn't know about this new target type — referrals.id is bigint,
-- so widen the column to text (works for both) and allow 'referral'.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'admin_actions' and column_name = 'target_id' and data_type = 'uuid'
  ) then
    alter table admin_actions alter column target_id type text using target_id::text;
  end if;

  if exists (select 1 from pg_constraint where conname = 'admin_actions_target_type_check') then
    alter table admin_actions drop constraint admin_actions_target_type_check;
  end if;

  alter table admin_actions add constraint admin_actions_target_type_check
    check (target_type in ('seller', 'listing', 'referral'));
end $$;

-- ============================================================
-- 00000000000019_need_journeys
-- ============================================================

-- رحلات الاحتياج (need journeys) — PLAN.md §20.38-41 / ROADMAP phase 3.
-- A journey groups the many things one life event actually requires (a wedding
-- needs a hall, a photographer, catering, flowers...) into one page, so the
-- user browses by *their need* rather than by our commercial categories.
--
-- Steps deliberately carry a search_query rather than only a category_id: the
-- platform has just 5 broad categories, so "مصور" and "قاعة أفراح" both live
-- under خدمات/محلات and can only be separated by the Arabic-normalized search
-- that already exists (search_listings in migration 6).

create table if not exists journeys (
  id serial primary key,
  name_ar text not null,
  slug text unique not null,
  description text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists journey_steps (
  id serial primary key,
  journey_id int references journeys(id) on delete cascade not null,
  title_ar text not null,
  search_query text,
  category_id int references categories(id),
  sort_order int default 0
);

create index if not exists idx_journey_steps_journey on journey_steps (journey_id, sort_order);

alter table journeys enable row level security;
alter table journey_steps enable row level security;

-- Public reference data, same shape as categories/neighborhoods (migration 12).
drop policy if exists "journeys_select_public" on journeys;
create policy "journeys_select_public" on journeys for select using (true);

drop policy if exists "journey_steps_select_public" on journey_steps;
create policy "journey_steps_select_public" on journey_steps for select using (true);

-- Seed the four journeys ChatGPT's brainstorm called out by name (PLAN.md §20.38-41).
insert into journeys (name_ar, slug, description, sort_order) values
  ('أجهز زواجي', 'wedding', 'كل اللي تحتاجه لترتيب زواجك بالزلفي بمكان واحد.', 1),
  ('بيتي الجديد', 'new-home', 'من النقل والتنظيف للأثاث والصيانة — ترتيب بيتك الجديد خطوة خطوة.', 2),
  ('مولود جديد', 'newborn', 'تصوير وتوزيعات وحلويات وهدايا لاستقبال مولودك.', 3),
  ('العودة للمدارس', 'back-to-school', 'مدرسين وقرطاسية وحقائب وكل مستلزمات العام الدراسي.', 4)
on conflict (slug) do nothing;

-- Steps are seeded once per journey; the "not exists" guard keeps this
-- idempotent without needing a unique constraint on free-text titles.
do $$
declare
  v_wedding int;
  v_new_home int;
  v_newborn int;
  v_school int;
  v_services int;
  v_shops int;
  v_home_producers int;
  v_real_estate int;
begin
  select id into v_wedding from journeys where slug = 'wedding';
  select id into v_new_home from journeys where slug = 'new-home';
  select id into v_newborn from journeys where slug = 'newborn';
  select id into v_school from journeys where slug = 'back-to-school';

  select id into v_services from categories where slug = 'services';
  select id into v_shops from categories where slug = 'shops';
  select id into v_home_producers from categories where slug = 'home-producers';
  select id into v_real_estate from categories where slug = 'real-estate';

  if not exists (select 1 from journey_steps where journey_id = v_wedding) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_wedding, 'قاعة أفراح', 'قاعة', v_services, 1),
      (v_wedding, 'تصوير', 'تصوير', v_services, 2),
      (v_wedding, 'ضيافة وقهوة', 'ضيافة', v_services, 3),
      (v_wedding, 'حلويات وكيك', 'حلى', v_home_producers, 4),
      (v_wedding, 'ورد وتنسيق', 'ورد', v_shops, 5),
      (v_wedding, 'كوش وديكور', 'كوشة', v_services, 6),
      (v_wedding, 'دعوات ومطبوعات', 'دعوات', v_shops, 7),
      (v_wedding, 'تجميل وكوافير', 'كوافير', v_services, 8);
  end if;

  if not exists (select 1 from journey_steps where journey_id = v_new_home) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_new_home, 'سكن للإيجار', 'شقة', v_real_estate, 1),
      (v_new_home, 'نقل عفش', 'نقل', v_services, 2),
      (v_new_home, 'تنظيف', 'تنظيف', v_services, 3),
      (v_new_home, 'تكييف', 'تكييف', v_services, 4),
      (v_new_home, 'كهرباء وسباكة', 'سباك', v_services, 5),
      (v_new_home, 'ستائر وسجاد', 'ستائر', v_shops, 6),
      (v_new_home, 'أثاث', 'أثاث', v_shops, 7);
  end if;

  if not exists (select 1 from journey_steps where journey_id = v_newborn) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_newborn, 'تصوير مواليد', 'تصوير', v_services, 1),
      (v_newborn, 'توزيعات', 'توزيعات', v_home_producers, 2),
      (v_newborn, 'حلويات', 'حلى', v_home_producers, 3),
      (v_newborn, 'هدايا', 'هدايا', v_shops, 4),
      (v_newborn, 'مستلزمات أطفال', 'أطفال', v_shops, 5);
  end if;

  if not exists (select 1 from journey_steps where journey_id = v_school) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_school, 'مدرسين خصوصي', 'مدرس', v_services, 1),
      (v_school, 'قرطاسية', 'قرطاسية', v_shops, 2),
      (v_school, 'حقائب مدرسية', 'حقيبة', v_shops, 3),
      (v_school, 'زي مدرسي', 'زي', v_shops, 4),
      (v_school, 'وجبات ومقاضي', 'وجبات', v_home_producers, 5);
  end if;
end $$;

-- ============================================================
-- 00000000000020_sponsorships
-- ============================================================

-- رعاية موسمية للأقسام (seasonal section sponsorship) — the single most
-- repeated monetization idea across every brainstorm source (PLAN.md §16.2,
-- §17.4-5, §18.4, §19.2, §20.6). A local business sponsors a whole category or
-- journey for a period; their name shows on that page.
--
-- Deliberately admin-managed with no self-serve checkout: Tap onboarding is
-- deferred (STATUS.md), and at this stage sponsorships are sold face to face
-- anyway. The schema records what was sold so the display is automatic.

create table if not exists sponsorships (
  id bigserial primary key,
  sponsor_name text not null,
  sponsor_url text,
  message text,
  -- 'home' has no target id; category/journey point at their own tables.
  target_type text not null check (target_type in ('home', 'category', 'journey')),
  target_id int,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  -- A category/journey sponsorship must name its target; a home one must not.
  constraint sponsorships_target_id_matches_type check (
    (target_type = 'home' and target_id is null)
    or (target_type in ('category', 'journey') and target_id is not null)
  ),
  constraint sponsorships_period_valid check (ends_at > starts_at)
);

create index if not exists idx_sponsorships_lookup
  on sponsorships (target_type, target_id, is_active, starts_at, ends_at);

alter table sponsorships enable row level security;

-- Public read: the sponsor banner is public by definition. Writes are admin
-- only (no insert/update policy for anon/authenticated at all).
drop policy if exists "sponsorships_select_public" on sponsorships;
create policy "sponsorships_select_public" on sponsorships for select using (
  is_active and now() >= starts_at and now() < ends_at
);

drop policy if exists "admin_all_sponsorships" on sponsorships;
create policy "admin_all_sponsorships" on sponsorships for all using (
  is_admin()
);

-- ============================================================
-- 00000000000021_need_requests
-- ============================================================

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

-- ============================================================
-- 00000000000022_market_pulse
-- ============================================================

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

-- ============================================================
-- 00000000000023_verified_reviews
-- ============================================================

-- "تعاملت معه فعلاً" — verified transactions and reviews (PLAN.md §20.17,
-- §19.10, ROADMAP phase 2 item 3). The trust problem in a small town is not a
-- lack of star ratings; it is that anonymous stars mean nothing when everyone
-- knows everyone. So a review here must be attached to a transaction that the
-- *seller also confirmed* — both sides on the record.
--
-- Flow: buyer signs in and marks "تعاملت مع هذا البائع" on a listing → the
-- seller sees a pending claim and confirms or disputes it → only a confirmed
-- transaction unlocks the review form.
--
-- This is the first feature requiring buyers to have accounts. profiles already
-- exists for every auth.users row (migration 4) with role 'buyer' by default,
-- so no new identity system is needed — only these two tables on top.

create table if not exists transactions (
  id bigserial primary key,
  listing_id uuid references listings(id) on delete set null,
  seller_id uuid references sellers(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'claimed'
    check (status in ('claimed', 'confirmed', 'disputed')),
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  -- One open claim per buyer per listing; re-buying the same item repeatedly is
  -- not worth modelling yet and this blocks claim spam.
  unique (buyer_id, listing_id)
);

create index if not exists idx_transactions_seller on transactions (seller_id, status);
create index if not exists idx_transactions_buyer on transactions (buyer_id);

create table if not exists reviews (
  id bigserial primary key,
  transaction_id bigint references transactions(id) on delete cascade not null unique,
  seller_id uuid references sellers(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create index if not exists idx_reviews_seller on reviews (seller_id, created_at desc);

alter table transactions enable row level security;
alter table reviews enable row level security;

-- ============================================================
-- transactions
-- ============================================================

drop policy if exists "transactions_select_own" on transactions;
create policy "transactions_select_own" on transactions for select using (
  buyer_id = auth.uid() or seller_id = auth.uid()
);

-- A buyer may only claim for themselves, only against a published listing, and
-- the claim always starts as 'claimed' — never pre-confirmed.
drop policy if exists "transactions_insert_buyer" on transactions;
create policy "transactions_insert_buyer" on transactions for insert with check (
  buyer_id = auth.uid()
  and status = 'claimed'
  and exists (
    select 1 from listings l
    where l.id = listing_id and l.status = 'published' and l.seller_id = transactions.seller_id
  )
  -- A seller cannot review themselves.
  and buyer_id <> seller_id
);

-- Only the seller confirms/disputes, and only their own rows. Column-level
-- REVOKE stops a seller from rewriting who the transaction belongs to (the
-- lesson from migration 15: WITH CHECK alone cannot pin unchanged columns).
revoke update (buyer_id, seller_id, listing_id, created_at) on transactions from authenticated;

drop policy if exists "transactions_update_seller" on transactions;
create policy "transactions_update_seller" on transactions for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid() and status in ('confirmed', 'disputed'));

drop policy if exists "admin_all_transactions" on transactions;
create policy "admin_all_transactions" on transactions for all using (
  is_admin()
);

-- ============================================================
-- reviews
-- ============================================================

-- Reviews are public — that is the whole point of the trust layer.
drop policy if exists "reviews_select_public" on reviews;
create policy "reviews_select_public" on reviews for select using (true);

-- The core rule: a review requires a transaction that belongs to this buyer AND
-- that the seller already confirmed. Enforced in the policy, not just the app,
-- so it holds even against a direct API call.
drop policy if exists "reviews_insert_verified" on reviews;
create policy "reviews_insert_verified" on reviews for insert with check (
  buyer_id = auth.uid()
  and exists (
    select 1 from transactions t
    where t.id = transaction_id
      and t.buyer_id = auth.uid()
      and t.seller_id = reviews.seller_id
      and t.status = 'confirmed'
  )
);

drop policy if exists "admin_all_reviews" on reviews;
create policy "admin_all_reviews" on reviews for all using (
  is_admin()
);

-- ============================================================
-- Public rating summary
-- ============================================================

-- SECURITY DEFINER + pinned search_path (the migration-15 lesson). Safe to
-- expose publicly: it returns only aggregates over already-public reviews.
create or replace function seller_rating(p_seller_id uuid)
returns table (average numeric, total bigint) as $$
  select round(avg(rating), 1), count(*)
  from reviews
  where seller_id = p_seller_id;
$$ language sql stable security definer set search_path = public, pg_temp;
