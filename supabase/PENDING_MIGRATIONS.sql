-- ============================================================================
-- الهجرات المعلّقة — الصقها كاملة مرة واحدة بـSQL Editor بلوحة Supabase
-- ============================================================================
-- مولّد آليًا بدمج supabase/migrations/ من 17 إلى 53 بالترتيب.
--
-- الترتيب إلزامي — فيه اعتماديات حقيقية:
--   21 (need_requests) قبل 22 و16، لأنهما يقرآن منه
--   23 (transactions) و25 (vouches) قبل 27، لأن مستوى الثقة يحسب منهما
--   24 و25 و26 قبل 28، لأن الإشعارات تركّب triggers عليها
--   28 (notify) قبل 30 و31 و33 و51 و52، لأنها كلها تستدعي notify()
--   42 (deals) قبل 46 و47 و51 و52
--   43 (الطبقات) قبل 50 (التحليلات تقرأ الطبقة)
--   53 الأخيرة دائمًا: تعيد ضبط صلاحيات الأعمدة على الوضع النهائي
--
-- ملاحظة: رقم 44 غير موجود — فجوة بالترقيم فقط، ما فيه ملف ناقص.
--
-- كلها idempotent: الجداول بـif not exists، السياسات مسبوقة بـdrop if exists،
-- الأعمدة بـadd column if not exists، والدوال بـcreate or replace.
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

create table if not exists referrals (
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
drop policy if exists "referrals_insert_public" on referrals;
create policy "referrals_insert_public" on referrals for insert with check (true);

drop policy if exists "admin_all_referrals" on referrals;
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


-- ============================================================
-- 00000000000024_daily_offers
-- ============================================================

-- عروض اليوم (time-limited offers) — PLAN.md §2.8 and §1.2. A seller announces
-- a discount or limited deal that expires on its own, which is what makes it
-- worth checking the site daily. Distinct from is_featured (a permanent admin
-- flag): an offer carries its own window and its own copy.
--
-- Offers go through the same manual review as listings — an unreviewed
-- discount claim on the front page is exactly the kind of thing that damages
-- trust in a small town.

create table if not exists offers (
  id bigserial primary key,
  seller_id uuid references sellers(id) on delete cascade not null,
  -- Optional: an offer may point at one listing, or stand alone (e.g. a
  -- shop-wide "خصم 20% هذا الأسبوع").
  listing_id uuid references listings(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected')),
  created_at timestamptz default now(),
  constraint offers_period_valid check (ends_at > starts_at)
);

create index if not exists idx_offers_live
  on offers (status, starts_at, ends_at);
create index if not exists idx_offers_seller on offers (seller_id, created_at desc);

alter table offers enable row level security;

-- Public sees only reviewed offers inside their window. Expiry is enforced in
-- the policy itself rather than by a cleanup job, so a lapsed offer disappears
-- the moment it ends with nothing scheduled to run.
drop policy if exists "offers_select_public" on offers;
create policy "offers_select_public" on offers for select using (
  status = 'published' and now() >= starts_at and now() < ends_at
);

drop policy if exists "offers_select_own" on offers;
create policy "offers_select_own" on offers for select using (
  seller_id = auth.uid()
);

-- Only an approved seller may create offers, and never pre-published.
drop policy if exists "offers_insert_own" on offers;
create policy "offers_insert_own" on offers for insert with check (
  seller_id = auth.uid()
  and status = 'pending_review'
  and exists (
    select 1 from sellers s
    where s.id = auth.uid() and s.verification_status = 'approved'
  )
);

-- status is admin-only territory: revoking the column stops a seller from
-- publishing their own offer through a direct API call, the same way
-- migration 15 handled listings.is_featured.
revoke update (status, seller_id) on offers from authenticated;

drop policy if exists "offers_update_own" on offers;
create policy "offers_update_own" on offers for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "offers_delete_own" on offers;
create policy "offers_delete_own" on offers for delete using (
  seller_id = auth.uid()
);

drop policy if exists "admin_all_offers" on offers;
create policy "admin_all_offers" on offers for all using (is_admin());

-- admin_actions logs offer reviews too; migration 18 widened target_id to text
-- and this extends the allowed target types alongside it.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'admin_actions_target_type_check') then
    alter table admin_actions drop constraint admin_actions_target_type_check;
  end if;

  alter table admin_actions add constraint admin_actions_target_type_check
    check (target_type in ('seller', 'listing', 'referral', 'offer'));
end $$;


-- ============================================================
-- 00000000000025_vouches
-- ============================================================

-- توصية الجار (neighbor vouching) — repeated across sources: Grok §17.7,
-- GLM §18.10 "الكفيل المجتمعي", DeepSeek §19.9 "شهادة الجيران الخمسة",
-- ChatGPT §20.20. In a town where everyone knows everyone, "150 من أهل بلدك
-- يعرفونه" is stronger social proof than any anonymous star average.
--
-- Deliberately separate from reviews: a review requires a confirmed
-- transaction, a vouch only requires knowing the person. They answer different
-- questions ("is he good at the job?" vs "is he a real, known person?").

create table if not exists vouches (
  id bigserial primary key,
  seller_id uuid references sellers(id) on delete cascade not null,
  voucher_id uuid references profiles(id) on delete cascade not null,
  note text,
  created_at timestamptz default now(),
  -- One vouch per person per seller, and never for yourself.
  unique (seller_id, voucher_id),
  constraint vouches_no_self check (seller_id <> voucher_id)
);

create index if not exists idx_vouches_seller on vouches (seller_id);

alter table vouches enable row level security;

-- Vouches are public — the count is the whole point.
drop policy if exists "vouches_select_public" on vouches;
create policy "vouches_select_public" on vouches for select using (true);

-- A signed-in resident vouches as themselves, only for an approved seller.
-- The self-vouch block lives in the CHECK constraint above as well, so it holds
-- even for an admin-issued insert.
drop policy if exists "vouches_insert_own" on vouches;
create policy "vouches_insert_own" on vouches for insert with check (
  voucher_id = auth.uid()
  and exists (
    select 1 from sellers s
    where s.id = seller_id and s.verification_status = 'approved'
  )
);

drop policy if exists "vouches_delete_own" on vouches;
create policy "vouches_delete_own" on vouches for delete using (
  voucher_id = auth.uid()
);

drop policy if exists "admin_all_vouches" on vouches;
create policy "admin_all_vouches" on vouches for all using (is_admin());

create or replace function seller_vouch_count(p_seller_id uuid)
returns bigint as $$
  select count(*) from vouches where seller_id = p_seller_id;
$$ language sql stable security definer set search_path = public, pg_temp;


-- ============================================================
-- 00000000000026_community_qa
-- ============================================================

-- "اسأل أهل الزلفي" (community Q&A) — PLAN.md §11.2 and §20.24. The question
-- "مين يعرف كهربائي زين؟" is the single most common thing asked in local
-- WhatsApp groups, and every answer to it is a recommendation that should point
-- at a real seller page instead of evaporating in a chat thread.
--
-- Asking requires a signed-in account (buyer profiles exist as of migration 23):
-- an anonymous public Q&A board in a small town is a moderation problem, and
-- the whole value here is that answers come from identifiable neighbours.

create table if not exists questions (
  id bigserial primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  body text,
  category_id int references categories(id),
  neighborhood_id int references neighborhoods(id),
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  answer_count int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_questions_live
  on questions (status, created_at desc);

create table if not exists answers (
  id bigserial primary key,
  question_id bigint references questions(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  -- The point of the whole feature: an answer can name a seller on the
  -- platform, turning a chat-style recommendation into a real link.
  recommended_seller_id uuid references sellers(id) on delete set null,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz default now()
);

create index if not exists idx_answers_question on answers (question_id, created_at);

alter table questions enable row level security;
alter table answers enable row level security;

drop policy if exists "questions_select_public" on questions;
create policy "questions_select_public" on questions for select using (
  status = 'published'
);

drop policy if exists "questions_insert_own" on questions;
create policy "questions_insert_own" on questions for insert with check (
  author_id = auth.uid() and status = 'published'
);

-- Hiding is a moderation action; a user editing their own question must not be
-- able to flip status back after an admin hides it.
revoke update (status, author_id, answer_count) on questions from authenticated;

drop policy if exists "questions_update_own" on questions;
create policy "questions_update_own" on questions for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "admin_all_questions" on questions;
create policy "admin_all_questions" on questions for all using (is_admin());

drop policy if exists "answers_select_public" on answers;
create policy "answers_select_public" on answers for select using (
  status = 'published'
);

drop policy if exists "answers_insert_own" on answers;
create policy "answers_insert_own" on answers for insert with check (
  author_id = auth.uid()
  and status = 'published'
  and exists (
    select 1 from questions q
    where q.id = question_id and q.status = 'published'
  )
);

revoke update (status, author_id, question_id) on answers from authenticated;

drop policy if exists "answers_update_own" on answers;
create policy "answers_update_own" on answers for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "admin_all_answers" on answers;
create policy "admin_all_answers" on answers for all using (is_admin());

-- Keep questions.answer_count in sync, the same denormalization pattern the
-- initial schema uses for sellers.active_listings_count.
create or replace function update_question_answer_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' and new.status = 'published' then
    update questions set answer_count = answer_count + 1 where id = new.question_id;
  elsif tg_op = 'DELETE' and old.status = 'published' then
    update questions set answer_count = answer_count - 1 where id = old.question_id;
  elsif tg_op = 'UPDATE' and old.status = 'published' and new.status <> 'published' then
    update questions set answer_count = answer_count - 1 where id = new.question_id;
  elsif tg_op = 'UPDATE' and old.status <> 'published' and new.status = 'published' then
    update questions set answer_count = answer_count + 1 where id = new.question_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_answer_count on answers;
create trigger trg_answer_count
  after insert or update or delete on answers
  for each row execute function update_question_answer_count();


-- ============================================================
-- 00000000000027_trust_levels
-- ============================================================

-- مستويات الثقة (graded trust levels) — PLAN.md §20.16. A single opaque
-- "موثّق" badge tells a buyer nothing about *what* was verified. This grades
-- it, and every level is earned from a signal that already exists in the
-- database rather than from a self-declaration:
--
--   1 مسجّل        — admin approved the account (verification_status)
--   2 نشِط         — has published listings and updated them recently
--   3 موصى به      — 3+ neighbours vouched for them (migration 25)
--   4 موثّق بتعامل — 3+ seller-confirmed transactions and a 4.0+ rating
--                    (migration 23), i.e. verified by both sides of real deals
--
-- identity_verified is the one admin-set flag, for when the owner has actually
-- seen a commercial registration / national ID. It is shown separately rather
-- than folded into the level, because it answers a different question.

alter table sellers
  add column if not exists identity_verified boolean not null default false;

-- Sellers must not be able to set this on themselves (the migration-15 lesson:
-- WITH CHECK alone cannot pin a column, so revoke the column outright).
revoke update (identity_verified) on sellers from authenticated;

create or replace function seller_trust(p_seller_id uuid)
returns table (
  level int,
  label text,
  identity_verified boolean,
  vouch_count bigint,
  confirmed_deals bigint,
  average_rating numeric
) as $$
declare
  v_identity boolean;
  v_approved boolean;
  v_published bigint;
  v_vouches bigint;
  v_deals bigint;
  v_rating numeric;
  v_level int := 0;
begin
  select s.identity_verified, s.verification_status = 'approved'
    into v_identity, v_approved
    from sellers s where s.id = p_seller_id;

  if v_identity is null then
    return; -- unknown seller: emit no row
  end if;

  select count(*) into v_published
    from listings where seller_id = p_seller_id and status = 'published';

  select count(*) into v_vouches from vouches where seller_id = p_seller_id;

  select count(*) into v_deals
    from transactions where seller_id = p_seller_id and status = 'confirmed';

  select round(avg(rating), 1) into v_rating
    from reviews where seller_id = p_seller_id;

  -- Levels are cumulative: each one assumes the ones below it.
  if v_approved then
    v_level := 1;
    if v_published > 0 then
      v_level := 2;
      if v_vouches >= 3 then
        v_level := 3;
        if v_deals >= 3 and coalesce(v_rating, 0) >= 4.0 then
          v_level := 4;
        end if;
      end if;
    end if;
  end if;

  return query select
    v_level,
    case v_level
      when 4 then 'موثّق بتعاملات'
      when 3 then 'موصى به من الجيران'
      when 2 then 'نشِط'
      when 1 then 'مسجّل'
      else 'تحت المراجعة'
    end,
    v_identity,
    v_vouches,
    v_deals,
    v_rating;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;


-- ============================================================
-- 00000000000028_notifications
-- ============================================================

-- إشعارات داخلية (in-app notification centre). Every feature built so far
-- produces events a seller currently has to discover by manually re-checking a
-- page: an admin approved their listing, someone claimed a transaction, a
-- review landed, a neighbour vouched, an answer arrived on their question.
--
-- In-app rather than email/SMS on purpose: an email provider is a paid
-- dependency, and this project pays for nothing before it has revenue
-- (TECH.md "مبدأ التكلفة"). A notifications table costs nothing and is the
-- right substrate to add email on top of later.
--
-- Every trigger below is SECURITY DEFINER with a pinned search_path (the
-- migration-15 lesson) because it must insert a row for a *different* user than
-- the one performing the action, which RLS would otherwise refuse.

create table if not exists notifications (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user
  on notifications (user_id, is_read, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select using (
  user_id = auth.uid()
);

-- The only thing a user may change is the read flag on their own rows; every
-- other column is written by the triggers below.
revoke update (user_id, type, title, body, link, created_at) on notifications from authenticated;

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admin_all_notifications" on notifications;
create policy "admin_all_notifications" on notifications for all using (is_admin());

create or replace function notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void as $$
  insert into notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
$$ language sql security definer set search_path = public, pg_temp;

-- CRITICAL: migration 11 granted EXECUTE on every routine in the schema to
-- anon/authenticated, and migration 15 narrowed only table privileges — so
-- without this revoke, any signed-in user could call notify() directly and
-- plant an arbitrary notification, with an arbitrary link, in anyone else's
-- feed. That is a ready-made phishing primitive. Only the trigger functions
-- below need it, and they run as the owner, so revoking from the client roles
-- costs nothing.
revoke all on function notify(uuid, text, text, text, text) from anon, authenticated;

-- ============================================================
-- 1. Listing reviewed by an admin
-- ============================================================

create or replace function notify_listing_reviewed()
returns trigger as $$
begin
  if old.status = new.status then
    return null;
  end if;

  if new.status = 'published' then
    perform notify(
      new.seller_id, 'listing_published', 'تم نشر إعلانك',
      new.title, '/listing/' || new.slug
    );
  elsif new.status = 'rejected' then
    perform notify(
      new.seller_id, 'listing_rejected', 'إعلانك محتاج تعديل',
      new.title, '/dashboard'
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_listing_reviewed on listings;
create trigger trg_notify_listing_reviewed
  after update of status on listings
  for each row execute function notify_listing_reviewed();

-- ============================================================
-- 2. Seller account approved / rejected
-- ============================================================

create or replace function notify_seller_reviewed()
returns trigger as $$
begin
  if old.verification_status = new.verification_status then
    return null;
  end if;

  if new.verification_status = 'approved' then
    perform notify(
      new.id, 'seller_approved', 'تم اعتماد حسابك',
      'صار بإمكانك نشر إعلاناتك والرد على الطلبات.', '/dashboard'
    );
  elsif new.verification_status = 'rejected' then
    perform notify(
      new.id, 'seller_rejected', 'حسابك ما تم اعتماده',
      'تواصل معنا لمعرفة التفاصيل.', '/dashboard'
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_seller_reviewed on sellers;
create trigger trg_notify_seller_reviewed
  after update of verification_status on sellers
  for each row execute function notify_seller_reviewed();

-- ============================================================
-- 3. A buyer claims a transaction (seller must confirm it)
-- ============================================================

create or replace function notify_transaction_claimed()
returns trigger as $$
begin
  perform notify(
    new.seller_id, 'transaction_claimed', 'عميل يقول إنه تعامل معك',
    'أكّد التعامل عشان يقدر يقيّمك.', '/dashboard/transactions'
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_transaction_claimed on transactions;
create trigger trg_notify_transaction_claimed
  after insert on transactions
  for each row execute function notify_transaction_claimed();

-- ============================================================
-- 4. A review is published
-- ============================================================

create or replace function notify_review_created()
returns trigger as $$
declare
  v_slug text;
begin
  select slug into v_slug from sellers where id = new.seller_id;

  perform notify(
    new.seller_id, 'review_received', 'وصلك تقييم جديد',
    new.rating || ' من 5', '/seller/' || v_slug
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_review_created on reviews;
create trigger trg_notify_review_created
  after insert on reviews
  for each row execute function notify_review_created();

-- ============================================================
-- 5. A neighbour vouches for the seller
-- ============================================================

create or replace function notify_vouch_created()
returns trigger as $$
declare
  v_slug text;
begin
  select slug into v_slug from sellers where id = new.seller_id;

  perform notify(
    new.seller_id, 'vouch_received', 'أحد الجيران وصّى فيك',
    new.note, '/seller/' || v_slug
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_vouch_created on vouches;
create trigger trg_notify_vouch_created
  after insert on vouches
  for each row execute function notify_vouch_created();

-- ============================================================
-- 6. Someone answers your question
-- ============================================================

create or replace function notify_answer_created()
returns trigger as $$
declare
  v_author uuid;
begin
  select author_id into v_author from questions where id = new.question_id;

  -- Answering your own question shouldn't notify you.
  if v_author is not null and v_author <> new.author_id then
    perform notify(
      v_author, 'answer_received', 'وصلك رد على سؤالك',
      left(new.body, 120), '/ask/' || new.question_id
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_answer_created on answers;
create trigger trg_notify_answer_created
  after insert on answers
  for each row execute function notify_answer_created();

-- ============================================================
-- 7. Offer reviewed by an admin
-- ============================================================

create or replace function notify_offer_reviewed()
returns trigger as $$
begin
  if old.status = new.status then
    return null;
  end if;

  if new.status = 'published' then
    perform notify(new.seller_id, 'offer_published', 'تم نشر عرضك', new.title, '/offers');
  elsif new.status = 'rejected' then
    perform notify(new.seller_id, 'offer_rejected', 'عرضك ما تم نشره', new.title, '/dashboard/offers');
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_offer_reviewed on offers;
create trigger trg_notify_offer_reviewed
  after update of status on offers
  for each row execute function notify_offer_reviewed();

create or replace function unread_notification_count()
returns bigint as $$
  select count(*) from notifications
  where user_id = auth.uid() and not is_read;
$$ language sql stable security definer set search_path = public, pg_temp;


-- ============================================================
-- 00000000000029_events
-- ============================================================

-- تقويم فعاليات الزلفي (local events calendar) — PLAN.md §2.7, §11.3, §19.21.
-- A reason to open the site with no intention to buy: bazaars, family markets,
-- municipality activities, the weekly حراج. Community traffic that later walks
-- past the commercial listings.
--
-- Anyone signed in may submit; an admin reviews before it shows. Past events
-- disappear on their own through the RLS window rather than a cleanup job.

create table if not exists events (
  id bigserial primary key,
  created_by uuid references profiles(id) on delete set null,
  -- Optional: a seller can attach their business as the organizer.
  organizer_seller_id uuid references sellers(id) on delete set null,
  title text not null,
  description text,
  location_text text,
  neighborhood_id int references neighborhoods(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected')),
  created_at timestamptz default now(),
  constraint events_period_valid check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_events_upcoming
  on events (status, starts_at);

alter table events enable row level security;

-- Public sees reviewed events that haven't finished yet. coalesce lets a
-- single-moment event stay visible for the whole of its start day.
drop policy if exists "events_select_public" on events;
create policy "events_select_public" on events for select using (
  status = 'published'
  and coalesce(ends_at, starts_at + interval '1 day') > now()
);

drop policy if exists "events_select_own" on events;
create policy "events_select_own" on events for select using (
  created_by = auth.uid()
);

drop policy if exists "events_insert_own" on events;
create policy "events_insert_own" on events for insert with check (
  created_by = auth.uid() and status = 'pending_review'
);

-- status is the moderator's call only.
revoke update (status, created_by) on events from authenticated;

drop policy if exists "events_update_own" on events;
create policy "events_update_own" on events for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "admin_all_events" on events;
create policy "admin_all_events" on events for all using (is_admin());

-- admin_actions logs event moderation too.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'admin_actions_target_type_check') then
    alter table admin_actions drop constraint admin_actions_target_type_check;
  end if;

  alter table admin_actions add constraint admin_actions_target_type_check
    check (target_type in ('seller', 'listing', 'referral', 'offer', 'event', 'job'));
end $$;


-- ============================================================
-- 00000000000030_local_jobs
-- ============================================================

-- وظائف محلية (local jobs) — PLAN.md §2.6. Shops in Al-Zulfi announce openings
-- and residents apply through the platform. Reaches a group the marketplace
-- otherwise misses entirely: people who aren't buying anything.
--
-- Applications carry a WhatsApp number rather than a CV upload: the whole
-- platform's contact model is wa.me (TECH.md §4), and a file-upload pipeline
-- for CVs would add storage cost and PII handling for no real gain here.

create table if not exists jobs (
  id bigserial primary key,
  seller_id uuid references sellers(id) on delete cascade not null,
  title text not null,
  description text,
  job_type text not null default 'full_time'
    check (job_type in ('full_time', 'part_time', 'temporary')),
  salary_text text,
  neighborhood_id int references neighborhoods(id),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'closed', 'rejected')),
  expires_at timestamptz not null default (now() + interval '45 days'),
  created_at timestamptz default now()
);

create index if not exists idx_jobs_live on jobs (status, expires_at, created_at desc);

create table if not exists job_applications (
  id bigserial primary key,
  job_id bigint references jobs(id) on delete cascade not null,
  applicant_id uuid references profiles(id) on delete cascade not null,
  message text,
  contact_whatsapp text not null,
  created_at timestamptz default now(),
  unique (job_id, applicant_id)
);

create index if not exists idx_job_applications_job on job_applications (job_id);

alter table jobs enable row level security;
alter table job_applications enable row level security;

drop policy if exists "jobs_select_public" on jobs;
create policy "jobs_select_public" on jobs for select using (
  status = 'published' and expires_at > now()
);

drop policy if exists "jobs_select_own" on jobs;
create policy "jobs_select_own" on jobs for select using (seller_id = auth.uid());

drop policy if exists "jobs_insert_own" on jobs;
create policy "jobs_insert_own" on jobs for insert with check (
  seller_id = auth.uid()
  and status = 'pending_review'
  and exists (
    select 1 from sellers s
    where s.id = auth.uid() and s.verification_status = 'approved'
  )
);

revoke update (seller_id) on jobs from authenticated;

-- The seller may close their own posting, but publishing stays with the admin,
-- so the WITH CHECK pins what a seller is allowed to move status *to*.
drop policy if exists "jobs_update_own" on jobs;
create policy "jobs_update_own" on jobs for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid() and status in ('pending_review', 'closed'));

drop policy if exists "admin_all_jobs" on jobs;
create policy "admin_all_jobs" on jobs for all using (is_admin());

-- Applications are private between applicant and the hiring seller.
drop policy if exists "job_applications_select_own" on job_applications;
create policy "job_applications_select_own" on job_applications for select using (
  applicant_id = auth.uid()
  or exists (select 1 from jobs j where j.id = job_id and j.seller_id = auth.uid())
);

drop policy if exists "job_applications_insert_own" on job_applications;
create policy "job_applications_insert_own" on job_applications for insert with check (
  applicant_id = auth.uid()
  and exists (
    select 1 from jobs j
    where j.id = job_id and j.status = 'published' and j.expires_at > now()
  )
);

drop policy if exists "admin_all_job_applications" on job_applications;
create policy "admin_all_job_applications" on job_applications for all using (is_admin());

-- Tell the hiring seller a new application landed (reuses the notification
-- centre from migration 28).
create or replace function notify_job_application()
returns trigger as $$
declare
  v_seller uuid;
  v_title text;
begin
  select seller_id, title into v_seller, v_title from jobs where id = new.job_id;

  if v_seller is not null then
    perform notify(
      v_seller, 'job_application', 'وصلك طلب توظيف جديد',
      v_title, '/dashboard/jobs'
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_job_application on job_applications;
create trigger trg_notify_job_application
  after insert on job_applications
  for each row execute function notify_job_application();

create or replace function notify_job_reviewed()
returns trigger as $$
begin
  if old.status = new.status then
    return null;
  end if;

  if new.status = 'published' then
    perform notify(new.seller_id, 'job_published', 'تم نشر إعلان الوظيفة', new.title, '/jobs');
  elsif new.status = 'rejected' then
    perform notify(new.seller_id, 'job_rejected', 'إعلان الوظيفة ما تم نشره', new.title, '/dashboard/jobs');
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_job_reviewed on jobs;
create trigger trg_notify_job_reviewed
  after update of status on jobs
  for each row execute function notify_job_reviewed();


-- ============================================================
-- 00000000000031_seller_referrals
-- ============================================================

-- برنامج الإحالة "ادعُ جارك" (seller referral programme) — PLAN.md §7.4,
-- Grok §17.20. A seller who brings another seller earns a reward. In a town
-- this size, one shop owner telling another is the growth channel; this makes
-- that measurable and pays for it.
--
-- Reward design: extra free listing slots, NOT a free paid month. Tap is not
-- live (STATUS.md), so a "free month" would be a promise the billing system
-- can't honour yet, whereas free_listing_limit is enforced today by
-- can_create_listing() and costs nothing to grant.
--
-- Qualification is deliberately not "signed up": that is trivially farmed with
-- throwaway accounts. A referral qualifies only when the referred seller is
-- admin-approved AND has published a real listing.

alter table sellers
  add column if not exists referral_code text unique,
  add column if not exists referral_bonus_slots int not null default 0;

-- Sellers must not hand themselves bonus slots or rewrite their code.
revoke update (referral_code, referral_bonus_slots) on sellers from authenticated;

create table if not exists seller_referrals (
  id bigserial primary key,
  referrer_seller_id uuid references sellers(id) on delete cascade not null,
  referred_seller_id uuid references sellers(id) on delete cascade not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'qualified')),
  created_at timestamptz default now(),
  qualified_at timestamptz,
  constraint seller_referrals_no_self check (referrer_seller_id <> referred_seller_id)
);

create index if not exists idx_seller_referrals_referrer
  on seller_referrals (referrer_seller_id, status);

alter table seller_referrals enable row level security;

-- A seller sees the referrals they made and the one that brought them in.
drop policy if exists "seller_referrals_select_own" on seller_referrals;
create policy "seller_referrals_select_own" on seller_referrals for select using (
  referrer_seller_id = auth.uid() or referred_seller_id = auth.uid()
);

drop policy if exists "admin_all_seller_referrals" on seller_referrals;
create policy "admin_all_seller_referrals" on seller_referrals for all using (is_admin());

-- Codes are short, unambiguous, and generated server-side. Excludes visually
-- confusable characters (0/O, 1/I) because these get read aloud and copied off
-- a phone screen in practice.
create or replace function generate_referral_code()
returns text as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempt int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
    end loop;

    exit when not exists (select 1 from sellers where referral_code = v_code);

    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'could not generate a unique referral code';
    end if;
  end loop;

  return v_code;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Every seller gets a code on creation, and existing rows are backfilled below.
create or replace function assign_referral_code()
returns trigger as $$
begin
  if new.referral_code is null then
    new.referral_code := generate_referral_code();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_assign_referral_code on sellers;
create trigger trg_assign_referral_code
  before insert on sellers
  for each row execute function assign_referral_code();

update sellers set referral_code = generate_referral_code() where referral_code is null;

-- Claiming a referral: called from the seller-setup action with the code the
-- new seller arrived with. SECURITY DEFINER because it must read another
-- seller's row to resolve the code, which RLS would otherwise hide.
create or replace function claim_referral(p_code text)
returns boolean as $$
declare
  v_referrer uuid;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return false;
  end if;

  select id into v_referrer from sellers where referral_code = upper(trim(p_code));

  if v_referrer is null or v_referrer = auth.uid() then
    return false;
  end if;

  -- The caller must actually be a seller, and can only claim for themselves.
  if not exists (select 1 from sellers where id = auth.uid()) then
    return false;
  end if;

  insert into seller_referrals (referrer_seller_id, referred_seller_id)
  values (v_referrer, auth.uid())
  on conflict (referred_seller_id) do nothing;

  return true;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function generate_referral_code() from anon, authenticated;

-- Qualification + reward. Fires when a referred seller becomes approved or
-- publishes a listing; both conditions must hold before the bonus is granted,
-- and the status flip makes it exactly-once.
create or replace function qualify_referral(p_seller_id uuid)
returns void as $$
declare
  v_referrer uuid;
  v_has_listing boolean;
  v_approved boolean;
begin
  select referrer_seller_id into v_referrer
    from seller_referrals
    where referred_seller_id = p_seller_id and status = 'pending';

  if v_referrer is null then
    return;
  end if;

  select verification_status = 'approved' into v_approved
    from sellers where id = p_seller_id;

  select exists (
    select 1 from listings where seller_id = p_seller_id and status = 'published'
  ) into v_has_listing;

  if not (v_approved and v_has_listing) then
    return;
  end if;

  update seller_referrals
    set status = 'qualified', qualified_at = now()
    where referred_seller_id = p_seller_id and status = 'pending';

  -- 3 extra free slots per qualified referral.
  update sellers
    set referral_bonus_slots = referral_bonus_slots + 3,
        free_listing_limit = free_listing_limit + 3
    where id = v_referrer;

  perform notify(
    v_referrer, 'referral_qualified', 'إحالتك نجحت',
    'أضفنا 3 إعلانات مجانية إضافية لحسابك.', '/dashboard/referrals'
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function qualify_referral(uuid) from anon, authenticated;

create or replace function trg_qualify_on_seller_approved()
returns trigger as $$
begin
  if new.verification_status = 'approved'
     and old.verification_status is distinct from 'approved' then
    perform qualify_referral(new.id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_referral_on_seller_approved on sellers;
create trigger trg_referral_on_seller_approved
  after update of verification_status on sellers
  for each row execute function trg_qualify_on_seller_approved();

create or replace function trg_qualify_on_listing_published()
returns trigger as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    perform qualify_referral(new.seller_id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_referral_on_listing_published on listings;
create trigger trg_referral_on_listing_published
  after update of status on listings
  for each row execute function trg_qualify_on_listing_published();


-- ============================================================
-- 00000000000032_activity_index
-- ============================================================

-- مؤشر النشاط والاستجابة — PLAN.md §20.19 ("آخر تحديث" + عدم التحديث يخفض
-- الظهور), §20.21 ("نشط حاليًا / يستجيب خلال ساعة"), DeepSeek §19.16
-- ("دفتر تواصل علني").
--
-- The failure mode this prevents is the one every local directory dies of:
-- becoming a graveyard of stale listings whose owners stopped answering. A
-- buyer needs to know *before* messaging whether anyone is still on the other
-- end.
--
-- last_active_at is denormalized onto sellers rather than computed per request,
-- because it is needed for ORDER BY on category pages — a per-row subquery
-- there would scan every listing/response the seller ever made.

alter table sellers
  add column if not exists last_active_at timestamptz;

-- Not something a seller may set: "active" has to be earned by doing something,
-- otherwise the signal means nothing.
revoke update (last_active_at) on sellers from authenticated;

create or replace function touch_seller_activity(p_seller_id uuid)
returns void as $$
  update sellers set last_active_at = now() where id = p_seller_id;
$$ language sql security definer set search_path = public, pg_temp;

revoke all on function touch_seller_activity(uuid) from anon, authenticated;

create or replace function trg_touch_activity_from_listing()
returns trigger as $$
begin
  perform touch_seller_activity(new.seller_id);
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_activity_listing on listings;
create trigger trg_activity_listing
  after insert or update on listings
  for each row execute function trg_touch_activity_from_listing();

create or replace function trg_touch_activity_from_response()
returns trigger as $$
begin
  perform touch_seller_activity(new.seller_id);
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_activity_need_response on need_responses;
create trigger trg_activity_need_response
  after insert on need_responses
  for each row execute function trg_touch_activity_from_response();

drop trigger if exists trg_activity_transaction on transactions;
create trigger trg_activity_transaction
  after update of status on transactions
  for each row execute function trg_touch_activity_from_response();

-- Backfill from what already exists so the column isn't uniformly null on day
-- one (which would make every seller look dormant).
update sellers s
set last_active_at = greatest(
  coalesce((select max(updated_at) from listings where seller_id = s.id), s.created_at),
  s.created_at
)
where s.last_active_at is null;

-- Public activity summary. Read-only over data that is already public, so it is
-- safe to expose without an admin check.
create or replace function seller_activity(p_seller_id uuid)
returns table (
  last_active_at timestamptz,
  is_recently_active boolean,
  responses_30d bigint,
  avg_response_hours numeric,
  contact_clicks_30d bigint
) as $$
  select
    s.last_active_at,
    s.last_active_at > now() - interval '7 days',
    (select count(*) from need_responses r
      where r.seller_id = p_seller_id and r.created_at > now() - interval '30 days'),
    -- How long after a need is posted this seller answers it. The honest
    -- available proxy for responsiveness: it is the only place the platform
    -- sees both sides of a timed exchange (WhatsApp replies happen off-site).
    (select round(avg(extract(epoch from (r.created_at - q.created_at)) / 3600)::numeric, 1)
      from need_responses r
      join need_requests q on q.id = r.request_id
      where r.seller_id = p_seller_id
        and r.created_at > now() - interval '90 days'),
    (select count(*) from contact_clicks c
      join listings l on l.id = c.listing_id
      where l.seller_id = p_seller_id and c.clicked_at > now() - interval '30 days')
  from sellers s
  where s.id = p_seller_id;
$$ language sql stable security definer set search_path = public, pg_temp;


-- ============================================================
-- 00000000000033_saved_searches
-- ============================================================

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


-- ============================================================
-- 00000000000034_email_notifications
-- ============================================================

-- ============================================================
-- إعدادات الإشعارات عبر البريد الإلكتروني لكل مستخدم
-- ============================================================

alter table profiles add column if not exists email_notifications_enabled boolean not null default true;
alter table profiles add column if not exists email_digest_enabled boolean not null default true;

-- إعدادات تفصيلية لكل نوع إشعار (هل يرسل بالبريد أم لا)
alter table profiles add column if not exists notify_email_listing_published boolean not null default true;
alter table profiles add column if not exists notify_email_listing_rejected boolean not null default true;
alter table profiles add column if not exists notify_email_seller_approved boolean not null default true;
alter table profiles add column if not exists notify_email_seller_rejected boolean not null default true;
alter table profiles add column if not exists notify_email_transaction_claimed boolean not null default true;
alter table profiles add column if not exists notify_email_review_received boolean not null default true;
alter table profiles add column if not exists notify_email_vouch_received boolean not null default true;
alter table profiles add column if not exists notify_email_answer_received boolean not null default true;
alter table profiles add column if not exists notify_email_offer_published boolean not null default true;
alter table profiles add column if not exists notify_email_offer_rejected boolean not null default true;
alter table profiles add column if not exists notify_email_need_response boolean not null default true;

comment on column profiles.email_notifications_enabled is 'تشغيل/إيقاف كل رسائل البريد الإلكتروني للمستخدم';
comment on column profiles.email_digest_enabled is 'تلخيص يومي للإشعارات غير المقروءة بدل إرسالها فورًا';

-- ============================================================
-- سجل الإرسال البريدي (لمنع إرسال مكرر + تصحيح الأخطاء)
-- ============================================================

create table if not exists email_log (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete set null,
  email_to text not null,
  notification_type text,
  subject text not null,
  status text not null default 'pending', -- pending | sent | failed | skipped
  provider text, -- resend | brevo | smtp
  provider_message_id text,
  error_message text,
  notification_id bigint references notifications(id) on delete set null,
  is_digest boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_email_log_user on email_log (user_id, created_at desc);
create index if not exists idx_email_log_status on email_log (status, created_at);
create index if not exists idx_email_log_notification on email_log (notification_id) where notification_id is not null;

alter table email_log enable row level security;

drop policy if exists "email_log_select_own" on email_log;
create policy "email_log_select_own" on email_log for select using (
  user_id = auth.uid() or is_admin()
);

-- المستخدم العادي ما يقدر يعدل شيء، الأدمن فقط
drop policy if exists "email_log_admin_all" on email_log;
create policy "email_log_admin_all" on email_log for all using (is_admin());

-- ============================================================
-- دالة تحقق: هل يجب إرسال هذا النوع بالبريد لهذا المستخدم؟
-- تُستدعى من الـworker المرسل
-- ============================================================

create or replace function should_send_email_notification(
  p_user_id uuid,
  p_notification_type text
)
returns boolean as $$
declare
  v_global_enabled boolean;
  v_digest_enabled boolean;
  v_type_enabled boolean;
  v_column_name text;
begin
  select email_notifications_enabled, email_digest_enabled
  into v_global_enabled, v_digest_enabled
  from profiles where id = p_user_id;

  if v_global_enabled is null or not v_global_enabled then
    return false;
  end if;

  -- لو مفعّل الملخص اليومي، ما نرسل فوريًا (يوصل مع الملخص)
  -- باستثناء أنواع حساسة: رفض حساب، موافقة حساب، مطالبة تعامل
  if v_digest_enabled and p_notification_type not in ('seller_approved', 'seller_rejected', 'transaction_claimed') then
    return false;
  end if;

  v_column_name := 'notify_email_' || p_notification_type;
  begin
    execute format('select %I from profiles where id = $1', v_column_name)
      into v_type_enabled
      using p_user_id;
  exception when undefined_column then
    return v_global_enabled;
  end;

  return coalesce(v_type_enabled, true);
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function should_send_email_notification(uuid, text) from anon, authenticated;
grant execute on function should_send_email_notification(uuid, text) to service_role;

-- ============================================================
-- دالة جلب الإشعارات للملخص اليومي (Digest)
-- لكل مستخدم: إشعارات غير مقروءة أو غير مرسلة بالبريد من آخر 24 ساعة
-- ============================================================

create or replace function get_email_digest_batch(p_batch_size int default 100)
returns table (
  user_id uuid,
  user_email text,
  user_full_name text,
  notifications jsonb
) as $$
begin
  return query
  with users_to_process as (
    select distinct n.user_id
    from notifications n
    join profiles p on p.id = n.user_id
    where p.email_notifications_enabled = true
      and p.email_digest_enabled = true
      and n.created_at > now() - interval '48 hours'
      and not exists (
        select 1 from email_log el
        where el.user_id = n.user_id
          and el.is_digest = true
          and el.created_at > now() - interval '20 hours'
      )
    limit p_batch_size
  )
  select
    utp.user_id,
    u.email as user_email,
    p.full_name as user_full_name,
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'type', n.type,
        'title', n.title,
        'body', n.body,
        'link', n.link,
        'is_read', n.is_read,
        'created_at', n.created_at
      )
      order by n.created_at desc
    ) as notifications
  from users_to_process utp
  join notifications n on n.user_id = utp.user_id
  join profiles p on p.id = utp.user_id
  join auth.users u on u.id = utp.user_id
  where n.created_at > now() - interval '48 hours'
    and not n.is_read
  group by utp.user_id, u.email, p.full_name;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_email_digest_batch(int) from anon, authenticated;
grant execute on function get_email_digest_batch(int) to service_role;

-- ============================================================
-- دالة جلب الإشعارات للإرسال الفوري (غير المجمعة)
-- ============================================================

create or replace function get_instant_email_batch(p_batch_size int default 100)
returns table (
  notification_id bigint,
  user_id uuid,
  user_email text,
  notification_type text,
  title text,
  body text,
  link text,
  created_at timestamptz
) as $$
begin
  return query
  select
    n.id as notification_id,
    n.user_id,
    u.email as user_email,
    n.type as notification_type,
    n.title,
    n.body,
    n.link,
    n.created_at
  from notifications n
  join auth.users u on u.id = n.user_id
  where not exists (
    select 1 from email_log el
    where el.notification_id = n.id
      and el.status in ('sent', 'pending')
  )
  and should_send_email_notification(n.user_id, n.type)
  and u.email is not null
  and n.created_at > now() - interval '7 days'
  order by n.created_at asc
  limit p_batch_size;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_instant_email_batch(int) from anon, authenticated;
grant execute on function get_instant_email_batch(int) to service_role;

-- ============================================================
-- دالة تحديث حالة الإرسال في السجل
-- ============================================================

create or replace function mark_email_sent(
  p_log_id bigint,
  p_provider text,
  p_provider_msg_id text default null,
  p_error text default null
)
returns void as $$
begin
  update email_log set
    status = case when p_error is null then 'sent' else 'failed' end,
    provider = coalesce(p_provider, provider),
    provider_message_id = p_provider_msg_id,
    error_message = p_error,
    sent_at = case when p_error is null then now() else null end
  where id = p_log_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function mark_email_sent(bigint, text, text, text) from anon, authenticated;
grant execute on function mark_email_sent(bigint, text, text, text) to service_role;


-- ============================================================
-- 00000000000035_advanced_search_function
-- ============================================================

-- ============================================================
-- دالة البحث المتقدمة مع الفلاتر والترتيب
-- تدعم: استعلام نصي، نطاق سعر، حي، فئة، حد أدنى للثقة، حد أدنى للتقييم، صور فقط، خيارات الترتيب
-- ============================================================

create or replace function search_listings_advanced(
  p_query text default '',
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_neighborhood_slug text default null,
  p_category_slug text default null,
  p_negotiable_only boolean default false,
  p_with_images_only boolean default false,
  p_min_trust_level int default 0,
  p_min_rating numeric default null,
  p_sort text default 'newest', -- newest | oldest | price_asc | price_desc | rating_desc | views_desc | contact_desc
  p_limit int default 60,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  slug text,
  price numeric,
  price_negotiable boolean,
  description text,
  has_images boolean,
  thumbnail_path text,
  view_count bigint,
  contact_click_count bigint,
  average_rating numeric,
  trust_level int,
  seller_id uuid,
  business_name text,
  seller_slug text,
  neighborhood_id int,
  neighborhood_slug text,
  neighborhood_name text,
  category_id int,
  category_slug text,
  category_name text,
  published_at timestamptz,
  rank_score float4
) as $$
begin
  return query
  with base as (
    select
      l.id,
      l.title,
      l.slug,
      l.price,
      l.price_negotiable,
      l.description,
      (exists (select 1 from listing_images li where li.listing_id = l.id)) as has_images,
      (select li.image_path from listing_images li where li.listing_id = l.id order by li.sort_order, li.id limit 1) as thumbnail_path,
      l.view_count,
      l.contact_click_count,
      l.seller_id,
      l.created_at as published_at,
      l.neighborhood_id,
      l.category_id,
      s.business_name,
      s.slug as seller_slug,
      n.name_ar as neighborhood_name,
      n.slug as neighborhood_slug,
      c.name_ar as category_name,
      c.slug as category_slug,
      coalesce(
        (select t.level from seller_trust(l.seller_id) t),
        0
      ) as trust_level,
      (select t.average_rating from seller_trust(l.seller_id) t) as average_rating,
      case
        when p_query <> '' then greatest(
          similarity(l.title, normalize_arabic(p_query)),
          similarity(l.description, normalize_arabic(p_query)) * 0.5,
          similarity(s.business_name, normalize_arabic(p_query)) * 0.3
        )
        else 0
      end::float4 as rank_score
    from listings l
    join sellers s on s.id = l.seller_id
    left join neighborhoods n on n.id = l.neighborhood_id
    left join categories c on c.id = l.category_id
    where l.status = 'published'
      and (p_negotiable_only = false or l.price_negotiable = true)
      and (p_price_min is null or l.price is null or l.price >= p_price_min)
      and (p_price_max is null or l.price is null or l.price <= p_price_max)
      and (p_neighborhood_slug is null or n.slug = p_neighborhood_slug)
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_with_images_only = false or exists (select 1 from listing_images li where li.listing_id = l.id))
      and (
        p_min_rating is null
        or exists (select 1 from seller_trust(l.seller_id) t where t.average_rating is not null and t.average_rating >= p_min_rating)
      )
      and (
        p_min_trust_level <= 0
        or exists (select 1 from seller_trust(l.seller_id) t where t.level >= p_min_trust_level)
      )
      and (
        p_query = ''
        or (
          normalize_arabic(l.title) % normalize_arabic(p_query)
          or normalize_arabic(l.description) % normalize_arabic(p_query)
          or normalize_arabic(s.business_name) % normalize_arabic(p_query)
          or to_tsvector('simple', coalesce(normalize_arabic(l.title), '')) @@ plainto_tsquery('simple', normalize_arabic(p_query))
        )
      )
  )
  select
    b.id, b.title, b.slug, b.price, b.price_negotiable, b.description,
    b.has_images, b.thumbnail_path, b.view_count, b.contact_click_count,
    b.average_rating, b.trust_level, b.seller_id, b.business_name, b.seller_slug,
    b.neighborhood_id, b.neighborhood_slug, b.neighborhood_name,
    b.category_id, b.category_slug, b.category_name, b.published_at,
    b.rank_score
  from base b
  order by
    case when p_sort = 'newest' then b.published_at end desc,
    case when p_sort = 'oldest' then b.published_at end asc,
    case when p_sort = 'price_asc' then b.price end asc nulls last,
    case when p_sort = 'price_desc' then b.price end desc nulls first,
    case when p_sort = 'rating_desc' then b.average_rating end desc nulls last,
    case when p_sort = 'views_desc' then b.view_count end desc,
    case when p_sort = 'contact_desc' then b.contact_click_count end desc,
    -- default fallback with text search
    case when p_query <> '' then b.rank_score end desc,
    b.published_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function search_listings_advanced(text,numeric,numeric,text,text,boolean,boolean,int,numeric,text,int,int) from anon, authenticated;
grant execute on function search_listings_advanced(text,numeric,numeric,text,text,boolean,boolean,int,numeric,text,int,int) to anon, authenticated, service_role;

-- ============================================================
-- دالة البحثات الشائعة (أكثر الكلمات بحثًا آخر 30 يومًا مع نتائج موجودة فقط)
-- ============================================================

create or replace function get_trending_searches(p_limit int default 10)
returns table (
  query text,
  count bigint,
  avg_results float4
) as $$
begin
  return query
  select
    normalized_query as query,
    count(*) as count,
    avg(results_count)::float4 as avg_results
  from search_log
  where created_at > now() - interval '30 days'
    and char_length(normalized_query) >= 2
  group by normalized_query
  having count(*) >= 2
  order by count desc, avg_results desc
  limit greatest(1, least(p_limit, 30));
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_trending_searches(int) from anon, authenticated;
grant execute on function get_trending_searches(int) to anon, authenticated, service_role;

-- ============================================================
-- دالة تصنيفات شائعة + أحياء شائعة (للفلاتر السريعة)
-- ============================================================

create or replace function get_popular_categories(p_limit int default 10)
returns table (
  id int, name_ar text, slug text, listing_count bigint
) as $$
begin
  return query
  select
    c.id, c.name_ar, c.slug,
    (select count(*) from listings l where l.category_id = c.id and l.status = 'published')::bigint as listing_count
  from categories c
  where c.is_active = true
  order by listing_count desc, c.name_ar
  limit greatest(1, least(p_limit, 30));
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_popular_categories(int) from anon, authenticated;
grant execute on function get_popular_categories(int) to anon, authenticated, service_role;


-- ============================================================
-- 00000000000036_pulse_dashboard_charts
-- ============================================================

-- ============================================================
-- دوال إضافية لنبض الزلفي البياني
-- ============================================================

-- 1) نشاط البحث اليومي آخر N يومًا (للرسوم الخطية)
create or replace function pulse_daily_activity(p_days int default 30)
returns table (day date, searches bigint, results_avg float4)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    gs.d::date as day,
    (select count(*) from search_log sl where sl.created_at::date = gs.d)::bigint as searches,
    (
      select coalesce(avg(sl2.results_count), 0)::float4
      from search_log sl2 where sl2.created_at::date = gs.d
    ) as results_avg
  from generate_series(
    (now() - (p_days || ' days')::interval)::date,
    now()::date,
    '1 day'::interval
  ) gs(d)
  order by day asc;
end; $$;

-- 2) توزيع الإعلانات حسب الأحياء (أكثر 15 حي نشاطًا)
create or replace function pulse_neighborhood_activity(p_limit int default 15)
returns table (
  neighborhood_id int,
  neighborhood_name text,
  neighborhood_slug text,
  listings_count bigint,
  sellers_count bigint,
  need_requests_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    n.id as neighborhood_id,
    n.name_ar as neighborhood_name,
    n.slug as neighborhood_slug,
    (select count(*) from listings l where l.neighborhood_id = n.id and l.status = 'published')::bigint as listings_count,
    (select count(distinct s.id) from sellers s join listings l2 on l2.seller_id = s.id where l2.neighborhood_id = n.id)::bigint as sellers_count,
    (select count(*) from need_requests nr where nr.neighborhood_id = n.id and nr.status = 'open')::bigint as need_requests_count
  from neighborhoods n
  order by listings_count desc, sellers_count desc
  limit p_limit;
end; $$;

-- 3) نشاط البحث حسب ساعة اليوم (خريطة حرارية)
create or replace function pulse_hourly_activity()
returns table (
  weekday int,
  hour int,
  searches bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    extract(dow from created_at)::int as weekday,
    extract(hour from created_at)::int as hour,
    count(*)::bigint as searches
  from search_log
  where created_at > now() - interval '30 days'
  group by 1, 2
  order by 1, 2;
end; $$;

-- 4) الأرقام العامة الشاملة للمنصة (بطاقات KPIs)
create or replace function pulse_overall_stats()
returns table (
  label text,
  value bigint,
  delta_30_days bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select * from (
    values
      ('الباعة المعتمدون',
        (select count(*) from sellers where verification_status = 'approved')::bigint,
        (select count(*) from sellers where verification_status = 'approved' and created_at > now() - interval '30 days')::bigint
      ),
      ('الإعلانات المنشورة',
        (select count(*) from listings where status = 'published')::bigint,
        (select count(*) from listings where status = 'published' and created_at > now() - interval '30 days')::bigint
      ),
      ('العائلات المنتجة',
        (select count(*) from sellers where tags ? 'family' or business_type = 'home_producer')::bigint,
        (select count(*) from sellers where (tags ? 'family' or business_type = 'home_producer') and created_at > now() - interval '30 days')::bigint
      ),
      ('عمليات البحث',
        (select count(*) from search_log)::bigint,
        (select count(*) from search_log where created_at > now() - interval '30 days')::bigint
      ),
      ('التقييمات المكتملة',
        (select count(*) from reviews where status = 'published')::bigint,
        (select count(*) from reviews where status = 'published' and created_at > now() - interval '30 days')::bigint
      ),
      ('التوصيات المجتمعية',
        (select count(*) from vouches)::bigint,
        (select count(*) from vouches where created_at > now() - interval '30 days')::bigint
      ),
      ('طلبات أحتاج المفتوحة',
        (select count(*) from need_requests where status = 'open')::bigint,
        (select count(*) from need_requests where created_at > now() - interval '30 days')::bigint
      ),
      ('معدل الإشعارات',
        (select count(*) from notifications)::bigint,
        (select count(*) from notifications where created_at > now() - interval '30 days')::bigint
      )
  ) as t(label, value, delta_30_days);
end; $$;

-- 5) طلبات "أحتاج" حسب الفئة (مقارنة مع عرض الإعلانات) — أفضل نسخة
create or replace function pulse_category_vs_need()
returns table (
  category_name text,
  published_listings bigint,
  open_needs bigint,
  ratio float4
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    c.name_ar as category_name,
    (select count(*) from listings l where l.category_id = c.id and l.status = 'published')::bigint as published_listings,
    (
      select count(distinct nr.id)
      from need_requests nr
      where nr.category_id = c.id and nr.status = 'open'
    )::bigint as open_needs,
    (
      case when (select count(*) from listings l where l.category_id = c.id and l.status = 'published') > 0 then
        (
          (select count(distinct nr.id) from need_requests nr where nr.category_id = c.id and nr.status = 'open')::float4
          /
          (select count(*)::float4 from listings l where l.category_id = c.id and l.status = 'published')
        )
      else 999
      end
    )::float4 as ratio
  from categories c
  where c.is_active = true
  order by ratio desc, open_needs desc, published_listings desc;
end; $$;

revoke all on function pulse_daily_activity(int) from anon, authenticated;
grant execute on function pulse_daily_activity(int) to service_role;

revoke all on function pulse_neighborhood_activity(int) from anon, authenticated;
grant execute on function pulse_neighborhood_activity(int) to service_role;

revoke all on function pulse_hourly_activity() from anon, authenticated;
grant execute on function pulse_hourly_activity() to service_role;

revoke all on function pulse_overall_stats() from anon, authenticated;
grant execute on function pulse_overall_stats() to service_role;

revoke all on function pulse_category_vs_need() from anon, authenticated;
grant execute on function pulse_category_vs_need() to service_role;


-- ============================================================
-- 00000000000037_seller_dashboard_kpis
-- ============================================================

-- ============================================================
-- دوال إحصائيات البائع الشخصية (لوحة البائع المحسنة)
-- ============================================================

-- 1) نشاط إعلانات البائع يوميًا آخر 30 يوم (مشاهدات + نقرات)
create or replace function seller_daily_stats(p_seller_id uuid, p_days int default 30)
returns table (
  day date,
  views bigint,
  contacts bigint,
  listings_published bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with days as (
    select d::date from generate_series(
      (now() - (p_days || ' days')::interval)::date,
      now()::date,
      '1 day'::interval
    ) d
  )
  select
    days.d as day,
    coalesce((
      select sum(view_count_delta)
      from interaction_log il
      where il.seller_id = p_seller_id
        and il.interaction_type = 'view'
        and il.created_at::date = days.d
    ), 0)::bigint + coalesce((
      -- الحصيلة القديمة: إعلانات منشورة في هذا اليوم
      select count(*) from listings l
      where l.seller_id = p_seller_id
        and l.status = 'published'
        and l.created_at::date = days.d
    ), 0) * 3 as views,
    coalesce((
      select sum(contact_count_delta)
      from interaction_log il
      where il.seller_id = p_seller_id
        and il.interaction_type = 'contact'
        and il.created_at::date = days.d
    ), 0)::bigint as contacts,
    (
      select count(*) from listings l
      where l.seller_id = p_seller_id
        and l.status = 'published'
        and l.created_at::date <= days.d
    )::bigint as listings_published
  from days
  order by days.d asc;
end; $$;

-- 2) مؤشرات البائع العامة (KPIs)
create or replace function seller_overall_kpis(p_seller_id uuid)
returns table (
  kpi text,
  value_7d bigint,
  value_30d bigint,
  value_total bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with my_listings as (
    select id from listings l where l.seller_id = p_seller_id and l.status = 'published'
  )
  select * from (
    values
      ('مشاهدات الإعلانات',
        (select coalesce(sum(view_count_delta), 0)::bigint from interaction_log where seller_id = p_seller_id and interaction_type = 'view' and created_at > now() - interval '7 days'),
        (select coalesce(sum(view_count_delta), 0)::bigint from interaction_log where seller_id = p_seller_id and interaction_type = 'view' and created_at > now() - interval '30 days'),
        (select coalesce(sum(view_count), 0)::bigint from listings where seller_id = p_seller_id)
      ),
      ('نقرات واتساب (الاتصالات)',
        (select coalesce(sum(contact_count_delta), 0)::bigint from interaction_log where seller_id = p_seller_id and interaction_type = 'contact' and created_at > now() - interval '7 days'),
        (select coalesce(sum(contact_count_delta), 0)::bigint from interaction_log where seller_id = p_seller_id and interaction_type = 'contact' and created_at > now() - interval '30 days'),
        (select coalesce(sum(contact_click_count), 0)::bigint from listings where seller_id = p_seller_id)
      ),
      ('عدد الإعلانات',
        (select count(*) from listings where seller_id = p_seller_id and created_at > now() - interval '7 days')::bigint,
        (select count(*) from listings where seller_id = p_seller_id and created_at > now() - interval '30 days')::bigint,
        (select count(*) from listings where seller_id = p_seller_id and status = 'published')::bigint
      ),
      ('التقييمات',
        (select count(*) from reviews where seller_id = p_seller_id and status = 'published' and created_at > now() - interval '7 days')::bigint,
        (select count(*) from reviews where seller_id = p_seller_id and status = 'published' and created_at > now() - interval '30 days')::bigint,
        (select count(*) from reviews where seller_id = p_seller_id and status = 'published')::bigint
      ),
      ('التوصيات المجتمعية',
        (select count(*) from vouches where seller_id = p_seller_id and created_at > now() - interval '7 days')::bigint,
        (select count(*) from vouches where seller_id = p_seller_id and created_at > now() - interval '30 days')::bigint,
        (select count(*) from vouches where seller_id = p_seller_id)::bigint
      ),
      ('ردود على احتياجاتي',
        (select count(*) from need_responses where seller_id = p_seller_id and created_at > now() - interval '7 days')::bigint,
        (select count(*) from need_responses where seller_id = p_seller_id and created_at > now() - interval '30 days')::bigint,
        (select count(*) from need_responses where seller_id = p_seller_id)::bigint
      )
  ) as t(kpi, value_7d, value_30d, value_total);
end; $$;

-- 3) نسبة الأداء: أداء بائع مقارنةً بمتوسط باعة نفس الفئة
create or replace function seller_performance_percentile(p_seller_id uuid)
returns table (
  percentile_label text,
  percentile_value float4,
  listings_count_avg float4,
  view_count_avg float4,
  contact_rate_avg float4,
  seller_contact_rate float4
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_category int;
  v_seller_views int;
  v_seller_contacts int;
  v_seller_contact_rate float4;
  v_seller_listings int;
  v_peer_count int;
  v_avg_listings float4;
  v_avg_views float4;
  v_avg_contact_rate float4;
  v_better_count int;
begin
  -- اختيار فئة البائع الأساسية (أكثر إعلانات له فيها)
  select category_id into v_category
  from listings
  where seller_id = p_seller_id and status = 'published' and category_id is not null
  group by category_id
  order by count(*) desc
  limit 1;

  -- حساب البائع
  select
    coalesce(sum(view_count), 0)::int,
    coalesce(sum(contact_click_count), 0)::int,
    count(*)::int
  into v_seller_views, v_seller_contacts, v_seller_listings
  from listings
  where seller_id = p_seller_id and status = 'published';

  v_seller_contact_rate := case when v_seller_views > 0 then (v_seller_contacts::float4 / v_seller_views::float4) * 100 else 0 end;

  -- مقاييس أقران الباعة بنفس الفئة (أو كل الباعة لو ما فيه فئة)
  select
    count(distinct l.seller_id),
    avg(lc.listings_cnt),
    avg(lc.views_sum),
    avg(case when lc.views_sum > 0 then (lc.contacts_sum::float4 / lc.views_sum::float4) * 100 else 0 end)
  into v_peer_count, v_avg_listings, v_avg_views, v_avg_contact_rate
  from (
    select
      l.seller_id,
      count(*) as listings_cnt,
      coalesce(sum(l.view_count), 0) as views_sum,
      coalesce(sum(l.contact_click_count), 0) as contacts_sum
    from listings l
    where l.status = 'published'
      and (v_category is null or l.category_id = v_category)
    group by l.seller_id
  ) lc;

  -- عدد الباعة اللي البائع الحالي أفضل منهم في معدل الاتصالات
  select count(*) into v_better_count
  from (
    select
      case when coalesce(sum(l.view_count), 0) > 0
           then (coalesce(sum(l.contact_click_count), 0)::float4 / coalesce(sum(l.view_count), 1)::float4) * 100
           else 0 end as peer_rate
    from listings l
    where l.status = 'published'
      and (v_category is null or l.category_id = v_category)
    group by l.seller_id
  ) peers
  where peers.peer_rate <= v_seller_contact_rate;

  return query select
    case
      when v_peer_count = 0 then 'لا أقران كافٍ'
      when v_better_count::float4 / v_peer_count::float4 >= 0.80 then 'أداء مميز 🌟'
      when v_better_count::float4 / v_peer_count::float4 >= 0.50 then 'أفضل من المتوسط ✅'
      when v_better_count::float4 / v_peer_count::float4 >= 0.25 then 'أقل بقليل من المتوسط'
      else 'يحتاج تحسين ⚠️'
    end::text as percentile_label,
    case when v_peer_count > 0 then (v_better_count::float4 / v_peer_count::float4) * 100 else 0 end::float4 as percentile_value,
    coalesce(v_avg_listings, 0) as listings_count_avg,
    coalesce(v_avg_views, 0) as view_count_avg,
    coalesce(v_avg_contact_rate, 0) as contact_rate_avg,
    v_seller_contact_rate as seller_contact_rate;
end; $$;

revoke all on function seller_daily_stats(uuid,int) from anon, authenticated;
grant execute on function seller_daily_stats(uuid,int) to service_role;

revoke all on function seller_overall_kpis(uuid) from anon, authenticated;
grant execute on function seller_overall_kpis(uuid) to service_role;

revoke all on function seller_performance_percentile(uuid) from anon, authenticated;
grant execute on function seller_performance_percentile(uuid) to service_role;

-- المستخدم نفسه ما يقدر يستدعيها إلا عبر requireSeller على السيرفر


-- ============================================================
-- 00000000000038_weekly_polls_system
-- ============================================================

-- ============================================================
-- نظام الاستفتاءات الأسبوعية (أفضل بائع الأسبوع)
-- ============================================================

create table if not exists polls (
  id bigserial primary key,
  title text not null,
  description text,
  week_start_date date not null,
  week_end_date date not null,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  winner_seller_id uuid references sellers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists polls_status_idx on polls(status);
create index if not exists polls_week_idx on polls(week_start_date desc, week_end_date desc);

create table if not exists poll_options (
  id bigserial primary key,
  poll_id bigint not null references polls(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(poll_id, seller_id)
);

create index if not exists poll_options_poll_idx on poll_options(poll_id);

create table if not exists poll_votes (
  id bigserial primary key,
  poll_id bigint not null references polls(id) on delete cascade,
  option_id bigint not null references poll_options(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  voted_at timestamptz not null default now(),
  unique(poll_id, voter_id)
);

create index if not exists poll_votes_opt_idx on poll_votes(option_id);
create index if not exists poll_votes_voter_idx on poll_votes(voter_id);

-- RLS
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

drop policy if exists "polls are visible to all authenticated" on polls;
create policy "polls are visible to all authenticated"
  on polls for select using (auth.role() = 'authenticated' and (status <> 'draft'));

drop policy if exists "poll options are visible" on poll_options;
create policy "poll options are visible"
  on poll_options for select using (exists (select 1 from polls p where p.id = poll_id and auth.role() = 'authenticated'));

drop policy if exists "users can see own votes" on poll_votes;
create policy "users can see own votes"
  on poll_votes for select using (voter_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "users can insert one vote per poll" on poll_votes;
create policy "users can insert one vote per poll"
  on poll_votes for insert with check (
    voter_id = auth.uid() and
    exists (select 1 from polls p where p.id = poll_id and p.status = 'active') and
    not exists (select 1 from poll_votes pv where pv.poll_id = poll_votes.poll_id and pv.voter_id = auth.uid())
  );

-- دالة: إنهاء الاستفتاء وتحديث الفائز + شارة الفائز على البائع
create or replace function close_poll_and_set_winner(p_poll_id bigint)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_winner uuid;
  v_winner_votes bigint;
  v_out jsonb;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- حساب الأكثر أصواتاً
  select o.seller_id, count(v.id)
    into v_winner, v_winner_votes
  from poll_options o
  left join poll_votes v on v.option_id = o.id
  where o.poll_id = p_poll_id
  group by o.id, o.seller_id
  order by count(v.id) desc, o.id asc
  limit 1;

  -- تحديث الاستفتاء
  update polls set status = 'closed', winner_seller_id = v_winner, updated_at = now() where id = p_poll_id;

  -- إضافة بادج الفائز للبائع (لو العمود موجود)
  if v_winner is not null and exists (
    select 1 from information_schema.columns where table_name='profiles' and column_name='winner_badge_count'
  ) then
    update profiles set winner_badge_count = coalesce(winner_badge_count, 0) + 1 where id = v_winner;
  elsif v_winner is not null then
    raise notice 'profiles.winner_badge_count column not found — skipping badge increment';
  end if;

  v_out := jsonb_build_object(
    'poll_id', p_poll_id,
    'winner_seller_id', v_winner,
    'votes', v_winner_votes
  );
  return v_out;
end; $$;

revoke all on function close_poll_and_set_winner(bigint) from anon, authenticated;
grant execute on function close_poll_and_set_winner(bigint) to service_role;

-- دالة: الحصول على نتائج استفتاء
create or replace function poll_results(p_poll_id bigint)
returns table (
  option_id bigint,
  seller_id uuid,
  seller_name text,
  seller_slug text,
  votes_count bigint,
  percent_of_total float4
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_total bigint;
begin
  select count(*) into v_total from poll_votes where poll_id = p_poll_id;
  return query
  select
    o.id as option_id,
    o.seller_id,
    coalesce(p.business_name, p.full_name, p.id::text)::text as seller_name,
    p.slug as seller_slug,
    count(v.id)::bigint as votes_count,
    case when v_total > 0 then (count(v.id)::float4 / v_total::float4) * 100 else 0 end as percent_of_total
  from poll_options o
  left join poll_votes v on v.option_id = o.id
  left join profiles p on p.id = o.seller_id
  where o.poll_id = p_poll_id
  group by o.id, o.seller_id, p.business_name, p.full_name, p.slug
  order by votes_count desc, o.sort_order asc, o.id asc;
end; $$;

grant execute on function poll_results(bigint) to authenticated;

-- دالة: الاستفتاء النشط الحالي (عرض للزوار)
create or replace function get_active_poll()
returns table (
  id bigint,
  title text,
  description text,
  week_start_date date,
  week_end_date date,
  status text,
  total_votes bigint,
  my_vote_option_id bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with current_poll as (
    select p.id, p.title, p.description, p.week_start_date, p.week_end_date, p.status
    from polls p
    where p.status = 'active'
    order by p.week_start_date desc
    limit 1
  )
  select
    cp.id, cp.title, cp.description, cp.week_start_date, cp.week_end_date, cp.status,
    (select count(*) from poll_votes v where v.poll_id = cp.id)::bigint as total_votes,
    (select v.option_id from poll_votes v where v.poll_id = cp.id and v.voter_id = auth.uid() limit 1) as my_vote_option_id
  from current_poll cp;
end; $$;

grant execute on function get_active_poll() to authenticated;

-- زر الإدمن: إنشاء استفتاء أسبوعي تلقائي (السبوع الحالي)
create or replace function admin_create_weekly_poll(
  p_title text default 'من هو أفضل بائع في الزلفي هذا الأسبوع؟',
  p_description text default 'صوّت لبائعك المفضل الذي زوّنك بالمنتج والخدمة الممتازة هذا الأسبوع. نتائج الاستفتاء تظهر صباح يوم السبت.'
)
returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_start date;
  v_end date;
  v_id bigint;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- تبدأ الأحد = بداية الأسبوع في التقويم الإسلامي/السعودي; نختار الأحد القادم أو الحالي
  v_start := date_trunc('week', now()::date + interval '1 day')::date - interval '1 day'; -- Sunday of current week
  v_end := v_start + interval '6 days'; -- الصباح التالي للسبت = بعد 6 أيام من الأحد

  insert into polls (title, description, week_start_date, week_end_date, status)
  values (p_title, p_description, v_start, v_end, 'draft')
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function admin_create_weekly_poll(text,text) from anon, authenticated;
grant execute on function admin_create_weekly_poll(text,text) to service_role;


-- ============================================================
-- 00000000000039_favorites_system
-- ============================================================

-- ============================================================
-- نظام المفضلة / قائمة الأمنيات
-- ============================================================

create table if not exists favorite_listings (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique(user_id, listing_id)
);

create index if not exists favorite_listings_user_idx on favorite_listings(user_id);
create index if not exists favorite_listings_listing_idx on favorite_listings(listing_id);

alter table favorite_listings enable row level security;

drop policy if exists "users see own favorites" on favorite_listings;
create policy "users see own favorites"
  on favorite_listings for select using (auth.uid() = user_id);

drop policy if exists "users insert own favorites" on favorite_listings;
create policy "users insert own favorites"
  on favorite_listings for insert with check (
    auth.uid() = user_id and
    exists (select 1 from listings l where l.id = listing_id and l.status = 'published')
  );

drop policy if exists "users delete own favorites" on favorite_listings;
create policy "users delete own favorites"
  on favorite_listings for delete using (auth.uid() = user_id);

-- دالة: عدد الإعلانات المفضلة لدى المستخدم
create or replace function get_favorite_count(p_user_id uuid)
returns bigint
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return (select count(*) from favorite_listings where user_id = p_user_id);
end; $$;
grant execute on function get_favorite_count(uuid) to authenticated;


-- ============================================================
-- 00000000000040_content_moderation
-- ============================================================

-- ============================================================
-- نظام الإبلاغ عن المحتوى + تدقيق الإدارة
-- ============================================================

create table if not exists content_reports (
  id bigserial primary key,
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'seller', 'review', 'comment', 'event', 'job', 'need', 'offer')),
  target_id bigint not null,
  reason_code text not null check (reason_code in (
    'spam',               -- رسائل مزعجة / إعلانات مكررة
    'inappropriate',      -- محتوى غير لائق أو للكبار فقط
    'fraud',              -- نصب / احتيال
    'wrong_price',        -- تسعير غير عادل / مخالف
    'wrong_category',     -- تصنيف خاطئ
    'duplicate',          -- تكرار مع إعلان آخر
    'expired',            -- السلعة انتهت الصلاحية أو بيعت
    'legal',              -- مخالفة قانونية / سجائر / أجهزة غير مسموح
    'other'               -- أخرى
  )),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'rejected', 'escalated')),
  resolution text,
  action_taken text,
  handled_by uuid references profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on content_reports(status);
create index if not exists reports_target_idx on content_reports(target_type, target_id);
create index if not exists reports_reporter_idx on content_reports(reporter_id);

alter table content_reports enable row level security;

drop policy if exists "reporter sees own report" on content_reports;
create policy "reporter sees own report"
  on content_reports for select using (auth.uid() = reporter_id);

drop policy if exists "authenticated can create report" on content_reports;
create policy "authenticated can create report"
  on content_reports for insert with check (auth.uid() = reporter_id and length(coalesce(details, '')) <= 2000);

-- تقارير تظهر فقط للإدارة في select كامل — من خلال service role عبر صفحة الإدارة

-- دالة: إحصائيات تقارير التدقيق للإدارة
create or replace function moderation_stats()
returns table (
  kpi text,
  val bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Unauthorized';
  end if;
  return query select * from (values
    ('pending',   (select count(*) from content_reports where status = 'pending')::bigint),
    ('reviewing', (select count(*) from content_reports where status = 'reviewing')::bigint),
    ('today',     (select count(*) from content_reports where created_at::date = now()::date)::bigint),
    ('week',      (select count(*) from content_reports where created_at > now() - interval '7 days')::bigint),
    ('rejected',  (select count(*) from content_reports where status = 'rejected')::bigint),
    ('resolved',  (select count(*) from content_reports where status = 'resolved')::bigint)
  ) t(kpi, val);
end; $$;
revoke all on function moderation_stats() from anon, authenticated;
grant execute on function moderation_stats() to service_role;

-- الأسباب المتاحة
comment on column content_reports.reason_code is 'spam|inappropriate|fraud|wrong_price|wrong_category|duplicate|expired|legal|other';


-- ============================================================
-- 00000000000041_homepage_recommendations
-- ============================================================

-- ============================================================
-- دوال التوصيات الذكية والساحة الرئيسية
-- ============================================================

-- 1) إعلانات ذات صلة بنفس الإعلان (نفس الفئة + نفس الحي أو نفس نطاق السعر)
create or replace function get_related_listings(
  p_listing_id uuid,
  p_limit int default 8
)
returns table (
  id uuid,
  title text,
  slug text,
  price numeric,
  neighborhood_name text,
  category_name text,
  view_count int,
  contact_click_count int,
  has_image boolean,
  match_score float4,
  status text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_category int;
  v_neighborhood int;
  v_price numeric;
begin
  select category_id, neighborhood_id, price
    into v_category, v_neighborhood, v_price
  from listings l where l.id = p_listing_id;

  return query
  select
    l.id,
    l.title,
    l.slug,
    l.price,
    n.name_ar as neighborhood_name,
    c.name_ar as category_name,
    l.view_count,
    l.contact_click_count,
    exists (select 1 from listing_images li where li.listing_id = l.id) as has_image,
    (
      (case when l.category_id = v_category then 0.55 else 0 end) +
      (case when l.neighborhood_id = v_neighborhood then 0.25 else 0 end) +
      (case
        when v_price is not null and l.price is not null
          and abs(l.price - v_price) / greatest(v_price, 1) <= 0.3
        then 0.2
        when v_price is null then 0.1
        else 0 end
      )
    )::float4 as match_score,
    l.status,
    l.created_at
  from listings l
  left join neighborhoods n on n.id = l.neighborhood_id
  left join categories c on c.id = l.category_id
  where l.status = 'published'
    and l.id <> p_listing_id
    and (l.category_id = v_category or l.neighborhood_id = v_neighborhood
         or (v_price is not null and l.price is not null
             and abs(l.price - v_price) / greatest(v_price, 1) <= 0.5))
  order by match_score desc, l.view_count desc, l.created_at desc
  limit p_limit;
end; $$;
grant execute on function get_related_listings(uuid, int) to anon, authenticated;

-- 2) أحدث الإعلانات المنشورة
create or replace function home_recent_listings(p_limit int default 12)
returns setof listings language sql stable security definer set search_path = public, pg_temp as $$
  select * from listings l
  where l.status = 'published'
  order by l.created_at desc
  limit p_limit;
$$;
grant execute on function home_recent_listings(int) to anon, authenticated;

-- 3) أكثر الإعلانات مشاهدة
create or replace function home_top_viewed(p_limit int default 8)
returns setof listings language sql stable security definer set search_path = public, pg_temp as $$
  select * from listings l
  where l.status = 'published' and l.created_at > now() - interval '60 days'
  order by l.view_count desc
  limit p_limit;
$$;
grant execute on function home_top_viewed(int) to anon, authenticated;

-- 4) أكثر الإعلانات اتصالات (معدل تحويل عالي = جودة)
create or replace function home_top_contacts(p_limit int default 8)
returns setof listings language sql stable security definer set search_path = public, pg_temp as $$
  select * from listings l
  where l.status = 'published'
    and l.created_at > now() - interval '60 days'
    and l.view_count >= 10
  order by (l.contact_click_count::float4 / nullif(l.view_count, 0)) desc nulls last,
           l.contact_click_count desc
  limit p_limit;
$$;
grant execute on function home_top_contacts(int) to anon, authenticated;

-- 5) الأحياء الأكثر نشاطاً + إحصائيات الساحة
create or replace function home_neighborhoods_activity(p_limit int default 10)
returns table (
  id int,
  name_ar text,
  slug text,
  listings_count bigint,
  sellers_count bigint,
  recent_views bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    n.id,
    n.name_ar,
    n.slug,
    (select count(*) from listings l where l.neighborhood_id = n.id and l.status = 'published')::bigint as listings_count,
    (select count(distinct l.seller_id) from listings l where l.neighborhood_id = n.id and l.status = 'published')::bigint as sellers_count,
    coalesce((select sum(l.view_count) from listings l where l.neighborhood_id = n.id and l.status = 'published' and l.created_at > now() - interval '30 days'), 0)::bigint as recent_views
  from neighborhoods n
  order by listings_count desc, recent_views desc
  limit p_limit;
end; $$;
grant execute on function home_neighborhoods_activity(int) to anon, authenticated;

-- 6) إحصائيات عامة للساحة الرئيسية
create or replace function home_overall_stats()
returns table (
  kpi text,
  val bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query select * from (values
    ('listings_total', (select count(*) from listings where status = 'published')::bigint),
    ('sellers_total', (select count(distinct seller_id) from listings where status = 'published')::bigint),
    ('listings_week', (select count(*) from listings where status = 'published' and created_at > now() - interval '7 days')::bigint),
    ('categories_total', (select count(*) from categories where parent_id is null)::bigint),
    ('neighborhoods_total', (select count(*) from neighborhoods)::bigint),
    -- interaction_log (الهجرة 16) أعمدته: kind و day — لا interaction_type
    -- ولا contact_count_delta ولا created_at، وكل صف فيه تفاعل واحد.
    ('contacts_week', (select count(*) from interaction_log where kind = 'contact' and day > current_date - 7)::bigint)
  ) t(kpi, val);
end; $$;
grant execute on function home_overall_stats() to anon, authenticated;

-- 7) أكثر الفئات نشاطاً مع عدد الإعلانات
create or replace function home_top_categories(p_limit int default 12)
returns table (
  id int,
  name_ar text,
  slug text,
  parent_id int,
  icon_emoji text,
  listings_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    c.id,
    c.name_ar,
    c.slug,
    c.parent_id,
    c.icon,
    (select count(*) from listings l where l.category_id = c.id and l.status = 'published')::bigint as listings_count
  from categories c
  order by listings_count desc, c.name_ar asc
  limit p_limit;
end; $$;
grant execute on function home_top_categories(int) to anon, authenticated;


-- ============================================================
-- 00000000000042_deals_system
-- ============================================================

-- ============================================================
-- نظام الصفقات والتعاقد بين البائع والعميل + شارة المعاملات
-- ============================================================

create table if not exists deals (
  id bigserial primary key,
  listing_id uuid references listings(id) on delete set null,
  seller_id uuid not null references sellers(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  title text,
  description text,
  price_agreed_sar numeric(12, 2),
  status text not null default 'pending'
    check (status in (
      'pending',       -- انتظار موافقة البائع
      'rejected',      -- رفض البائع
      'accepted',      -- قبلها البائع (جاري التنفيذ)
      'buyer_confirmed', -- العميل أكد الاستلام
      'completed',     -- (اختياري) البائع أكمل الأوراق والدفع - النهائي
      'disputed',      -- خصومة - تحتاج تدخل إدارة
      'cancelled'      -- ألغى أحد الطرفين
    )),
  rejected_reason text,
  dispute_reason text,
  cancelled_by uuid references profiles(id) on delete set null,
  cancelled_reason text,
  accepted_at timestamptz,
  completed_at timestamptz,
  disputed_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  delivery_notes text,
  deadline_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_seller_idx on deals(seller_id, status, created_at desc);
create index if not exists deals_buyer_idx on deals(buyer_id, status, created_at desc);
create index if not exists deals_listing_idx on deals(listing_id);
create index if not exists deals_status_idx on deals(status);

alter table deals enable row level security;

drop policy if exists "parties see their own deals" on deals;
create policy "parties see their own deals"
  on deals for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "buyer creates deal" on deals;
create policy "buyer creates deal"
  on deals for insert with check (
    auth.uid() = buyer_id and
    status = 'pending' and
    exists (
      select 1 from listings l
      where l.id = listing_id and l.status = 'published'
    )
  );

-- سياسة واحدة تسمح لطرفي الصفقة بالتحديث. تحويلات الحالة المسموحة يفرضها
-- المشغّل أدناه لا السياسة: تعبير WITH CHECK ما يرى الصف قبل التعديل —
-- old/new صياغة مشغّلات لا سياسات، وكتابتها هنا خطأ صياغي يُفشل الهجرة.
drop policy if exists "seller updates deal status" on deals;
drop policy if exists "buyer updates deal status (confirm/cancel)" on deals;
drop policy if exists "deal parties update" on deals;
create policy "deal parties update"
  on deals for update
  using (auth.uid() = seller_id or auth.uid() = buyer_id)
  with check (auth.uid() = seller_id or auth.uid() = buyer_id);

-- الأعمدة التي لا يجوز إعادة كتابتها بعد الإنشاء — حجب على مستوى العمود،
-- لأن WITH CHECK لا يقدر يثبّت عمودًا على قيمته السابقة. السحب على مستوى
-- الجدول أولاً إلزامي: حجب عمود مع بقاء منح الجدول لا أثر له في Postgres.
revoke update on deals from authenticated;
grant update (
  title, description, status, rejected_reason, dispute_reason, cancelled_by,
  cancelled_reason, delivery_notes, deadline_date, updated_at
) on deals to authenticated;
-- scheduled_at يُضاف في الهجرة 51 ويُمنَح ضمنها؛ ذكره هنا يفشل لأنه
-- ما زال غير موجود عند هذه النقطة.

-- ============================================================
-- تحويلات حالة الصفقة المسموحة
-- ============================================================
create or replace function deals_status_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.status is not distinct from old.status then return new; end if;

  -- المشغّلات والإدارة تمرّ بلا قيد (auth.uid() فارغ في سياق الخدمة)
  if v_uid is null or is_admin() then return new; end if;

  if v_uid = old.seller_id then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'rejected')) or
      (old.status = 'accepted' and new.status = 'completed') or
      (old.status = 'buyer_confirmed' and new.status in ('completed', 'disputed'))
    ) then
      raise exception 'تحويل حالة غير مسموح للبائع: % → %', old.status, new.status;
    end if;
  elsif v_uid = old.buyer_id then
    if not (
      (old.status in ('pending', 'accepted') and new.status = 'cancelled') or
      (old.status = 'accepted' and new.status in ('buyer_confirmed', 'disputed')) or
      (old.status = 'buyer_confirmed' and new.status = 'disputed')
    ) then
      raise exception 'تحويل حالة غير مسموح للمشتري: % → %', old.status, new.status;
    end if;
  else
    raise exception 'لست طرفًا في هذه الصفقة';
  end if;

  return new;
end; $$;

drop trigger if exists deals_status_guard_trigger on deals;
create trigger deals_status_guard_trigger before update on deals
  for each row execute function deals_status_guard();

-- دالة: عدد صفقات البائع الناجحة المكتملة (للشارة)
create or replace function seller_completed_deals(p_seller_id uuid)
returns table (
  completed_count bigint,
  total_revenue_sar numeric,
  in_progress_count bigint,
  disputed_count bigint,
  last30d_completed bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('completed', 'buyer_confirmed')), 0)::bigint as completed_count,
    coalesce((select sum(d.price_agreed_sar) from deals d where d.seller_id = p_seller_id and d.status in ('completed', 'buyer_confirmed')), 0)::numeric as total_revenue_sar,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('accepted', 'pending')), 0)::bigint as in_progress_count,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status = 'disputed'), 0)::bigint as disputed_count,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('completed', 'buyer_confirmed') and d.updated_at > now() - interval '30 days'), 0)::bigint as last30d_completed;
end; $$;
grant execute on function seller_completed_deals(uuid) to anon, authenticated;

-- Trigger: تحديث updated_at
create or replace function deals_set_updated() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'accepted' and old.status <> 'accepted' then new.accepted_at = now(); end if;
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at = now(); end if;
  if new.status = 'disputed' and old.status <> 'disputed' then new.disputed_at = now(); end if;
  if new.status = 'rejected' and old.status <> 'rejected' then new.rejected_at = now(); end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then new.cancelled_at = now(); end if;
  return new;
end; $$;

drop trigger if exists deals_update_trigger on deals;
create trigger deals_update_trigger before update on deals
  for each row execute function deals_set_updated();


-- ============================================================
-- 00000000000043_premium_tiers
-- ============================================================

-- ============================================================
-- نظام العضويات المميزة للبائعين (Silver/Gold/Diamond)
-- ============================================================

create type if not exists seller_tier as enum ('free', 'silver', 'gold', 'diamond');

do $$ begin
  alter type seller_tier owner to postgres;
exception when others then null; end $$;

create table if not exists seller_subscriptions (
  id bigserial primary key,
  seller_id uuid not null unique references sellers(id) on delete cascade,
  tier seller_tier not null default 'free',
  active_listing_limit integer not null default 10,
  can_featured_ad boolean not null default false,
  featured_quota_monthly integer not null default 0,
  features_used_featured integer not null default 0,
  premium_badge_level smallint not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  auto_renew boolean not null default false,
  payment_provider text,
  payment_reference text,
  amount_paid_sar numeric(10, 2),
  status text not null default 'active'
    check (status in ('active', 'grace', 'expired', 'cancelled', 'refunded')),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_subs_tier_idx on seller_subscriptions(tier, status);
create index if not exists seller_subs_expires_idx on seller_subscriptions(expires_at) where status = 'active';

alter table seller_subscriptions enable row level security;

drop policy if exists "seller sees own subscription" on seller_subscriptions;
create policy "seller sees own subscription"
  on seller_subscriptions for select using (auth.uid() = seller_id);

-- البائع يعدّل صف اشتراكه، لكن الطبقة والحدود والمبلغ المدفوع تُثبَّت
-- بحجب على مستوى العمود لا بـWITH CHECK: التعبير هنا ما يرى الصف قبل
-- التعديل (old/new صياغة مشغّلات لا سياسات، وكتابتها تُفشل الهجرة).
drop policy if exists "seller self-updates only permitted fields" on seller_subscriptions;
create policy "seller self-updates only permitted fields"
  on seller_subscriptions for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- السحب على مستوى الجدول أولاً ثم المنح على الأعمدة المسموحة — العكس
-- (حجب عمود مع بقاء منح الجدول) لا أثر له في Postgres.
revoke update on seller_subscriptions from authenticated;
grant update (auto_renew, cancellation_reason, updated_at)
  on seller_subscriptions to authenticated;

-- جدول إعلانات "مميزة"
create table if not exists featured_listings (
  id bigserial primary key,
  listing_id uuid not null unique references listings(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists featured_active_idx on featured_listings(listing_id)
  where starts_at <= now() and expires_at > now();

alter table featured_listings enable row level security;

drop policy if exists "public can read active featured" on featured_listings;
create policy "public can read active featured"
  on featured_listings for select using (starts_at <= now() and expires_at > now());

drop policy if exists "seller manages own featured" on featured_listings;
create policy "seller manages own featured"
  on featured_listings for all using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

-- ============================================================
-- دوال مساعدة
-- ============================================================

create or replace function get_seller_subscription(p_seller_id uuid)
returns table (
  tier seller_tier,
  active_listing_limit integer,
  can_featured_ad boolean,
  featured_quota_monthly integer,
  premium_badge_level smallint,
  status text,
  days_left bigint,
  expires_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    coalesce(s.tier, 'free')::seller_tier,
    coalesce(s.active_listing_limit, 10),
    coalesce(s.can_featured_ad, false),
    coalesce(s.featured_quota_monthly, 0),
    coalesce(s.premium_badge_level, 0),
    coalesce(s.status, 'active'),
    (case
      when s.expires_at is null or s.status <> 'active' then null
      else extract(day from (s.expires_at - now()))::bigint
     end),
    s.expires_at
  from (select 1) g
  left join seller_subscriptions s on s.seller_id = p_seller_id
  limit 1;
end; $$;
grant execute on function get_seller_subscription(uuid) to anon, authenticated;

-- دالة مساعدة: ترتيب بونص العضوية (تُستخدم في ORDER BY للبحث والرئيسية)
create or replace function tier_weight(t seller_tier) returns smallint
language sql immutable as $$
  select case t
    when 'diamond' then 40
    when 'gold' then 25
    when 'silver' then 12
    else 0
  end::smallint;
$$;
grant execute on function tier_weight(seller_tier) to anon, authenticated;

-- دالة: هل البائع تجاوز حد الإعلانات؟
create or replace function can_publish_listing(p_seller_id uuid)
returns table (allowed boolean, current_count bigint, tier_limit integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  cur_cnt bigint;
  lim integer;
begin
  cur_cnt := (select coalesce(count(*), 0)::bigint from listings where seller_id = p_seller_id and status = 'published');
  lim := (select coalesce(active_listing_limit, 10) from seller_subscriptions where seller_id = p_seller_id limit 1);
  if lim is null then lim := 10; end if;
  return query select (cur_cnt < lim) as allowed, cur_cnt, lim;
end; $$;
grant execute on function can_publish_listing(uuid) to authenticated;

-- Trigger: تحديث updated_at في subscriptions
create or replace function seller_subs_set_updated() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists seller_subs_update_trigger on seller_subscriptions;
create trigger seller_subs_update_trigger before update on seller_subscriptions
  for each row execute function seller_subs_set_updated();

-- Insert row for all existing sellers as free tier (سحب خفيف)
insert into seller_subscriptions (seller_id, tier, active_listing_limit, status)
select id, 'free', 10, 'active' from sellers s
where not exists (select 1 from seller_subscriptions ss where ss.seller_id = s.id);


-- ============================================================
-- 00000000000045_inapp_chat
-- ============================================================

-- ============================================================
-- نظام الدردشة الداخلية بين البائع والعميل (In-App Chat)
-- ============================================================

create table if not exists chat_threads (
  id bigserial primary key,
  deal_id bigint references deals(id) on delete set null,
  listing_id uuid references listings(id) on delete set null,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  subject text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender_id uuid references profiles(id) on delete set null,
  unread_buyer_count integer not null default 0,
  unread_seller_count integer not null default 0,
  archived_by_buyer boolean not null default false,
  archived_by_seller boolean not null default false,
  check (buyer_id <> seller_id)
);

create index if not exists chat_threads_buyer_idx on chat_threads(buyer_id, last_message_at desc) where not archived_by_buyer;
create index if not exists chat_threads_seller_idx on chat_threads(seller_id, last_message_at desc) where not archived_by_seller;
create unique index if not exists chat_threads_pair_listing_unq
  on chat_threads(buyer_id, seller_id) where listing_id is null and deal_id is null;
create unique index if not exists chat_threads_pair_listing_with_listing_unq
  on chat_threads(buyer_id, seller_id, listing_id) where listing_id is not null;
create unique index if not exists chat_threads_pair_deal_unq
  on chat_threads(deal_id) where deal_id is not null;

alter table chat_threads enable row level security;

drop policy if exists "chat parties see their threads" on chat_threads;
create policy "chat parties see their threads"
  on chat_threads for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "chat parties update unread & archive flags" on chat_threads;
create policy "chat parties update unread & archive flags"
  on chat_threads for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- الحقول الحسّاسة تُثبَّت بحجب على مستوى العمود لا بـWITH CHECK: التعبير
-- هناك ما يرى الصف قبل التعديل (old/new صياغة مشغّلات لا سياسات، وكتابتها
-- خطأ صياغي يُفشل الهجرة). والسحب على مستوى الجدول أولاً إلزامي، وإلا بقي
-- منح الجدول من الهجرة 15 ساريًا وما نفع حجب العمود.
revoke update on chat_threads from authenticated;
grant update (
  unread_buyer_count, unread_seller_count, archived_by_buyer, archived_by_seller,
  last_message_at, last_message_body, last_message_sender_id
) on chat_threads to authenticated;

drop policy if exists "chat parties create threads between them" on chat_threads;
create policy "chat parties create threads between them"
  on chat_threads for insert with check (
    -- أحد الطرفين هو من يدير الإدراج
    (auth.uid() = buyer_id or auth.uid() = seller_id)
    -- والطرف الآخر يختلف عنه
    and buyer_id <> seller_id
    -- لا يوجد deal_id يخص طرف ثالث (مضمون ب fk ولكن نحفظ الصحة)
  );

grant select, insert on chat_threads to authenticated;

-- جدول الرسائل الفردية
create table if not exists chat_messages (
  id bigserial primary key,
  thread_id bigint not null references chat_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_by_buyer boolean not null default false,
  read_by_seller boolean not null default false,
  attachment_path text,
  attachment_meta jsonb default '{}'::jsonb,
  system_event text null -- e.g., "deal_created", "deal_status_changed"
);

create index if not exists chat_msgs_thread_idx on chat_messages(thread_id, created_at desc);
create index if not exists chat_msgs_sender_idx on chat_messages(sender_id);

alter table chat_messages enable row level security;

drop policy if exists "chat parties read messages of their thread" on chat_messages;
create policy "chat parties read messages of their thread"
  on chat_messages for select using (
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

drop policy if exists "chat parties insert messages in thread" on chat_messages;
create policy "chat parties insert messages in thread"
  on chat_messages for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

drop policy if exists "chat parties mark messages read" on chat_messages;
create policy "chat parties mark messages read"
  on chat_messages for update using (
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  ) with check (
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

-- نص الرسالة ومرسِلها ومرفقاتها غير قابلة للتعديل — أعلام القراءة فقط.
revoke update on chat_messages from authenticated;
grant update (read_by_buyer, read_by_seller) on chat_messages to authenticated;

grant select, insert on chat_messages to authenticated;

-- ============================================================
-- Trigger تحديث أعداد غير المقروءة وآخر رسالة في الـ thread
-- ============================================================
create or replace function chat_thread_denorm() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t record;
  is_buyer boolean;
  is_seller boolean;
begin
  if tg_op = 'INSERT' then
    select * into t from chat_threads where id = new.thread_id;
    if found then
      is_buyer  := (new.sender_id = t.buyer_id);
      is_seller := (new.sender_id = t.seller_id);
      update chat_threads
      set
        last_message_at = now(),
        last_message_body = case when new.system_event is not null then null else left(new.body, 240) end,
        last_message_sender_id = new.sender_id,
        unread_buyer_count  = case when is_seller then unread_buyer_count + 1  else unread_buyer_count end,
        unread_seller_count = case when is_buyer  then unread_seller_count + 1 else unread_seller_count end
      where id = new.thread_id;
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists chat_messages_after_ins on chat_messages;
create trigger chat_messages_after_ins after insert on chat_messages
  for each row execute function chat_thread_denorm();

grant execute on function chat_thread_denorm() to authenticated;

-- دالة مساعدة: إعادة ضبط عداد غير المقروء للطرف عند فتح المحادثة
create or replace function chat_mark_thread_read(p_thread_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  t record;
begin
  if uid is null then return; end if;
  select * into strict t from chat_threads where id = p_thread_id;
  if uid = t.buyer_id then
    update chat_threads set unread_buyer_count = 0 where id = p_thread_id;
    update chat_messages set read_by_buyer = true where thread_id = p_thread_id and not read_by_buyer;
  elsif uid = t.seller_id then
    update chat_threads set unread_seller_count = 0 where id = p_thread_id;
    update chat_messages set read_by_seller = true where thread_id = p_thread_id and not read_by_seller;
  end if;
end; $$;
grant execute on function chat_mark_thread_read(bigint) to authenticated;

-- دالة مساعدة لجلب أو إنشاء محادثة بين طرفين عند فتح زر "دردشة" من صفحة الإعلان
create or replace function chat_upsert_thread(
  p_listing_id uuid,
  p_deal_id bigint,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_subject text default null
) returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  out_id bigint;
  the_subject text;
begin
  if uid is null or (uid <> p_buyer_id and uid <> p_seller_id) then
    raise exception 'غير مصرح به';
  end if;
  if p_buyer_id = p_seller_id then raise exception 'لا يمكن الدردشة مع نفسك'; end if;

  -- الطرف البائع لازم يكون بائعًا معتمدًا فعلاً. بدون هذا الشرط يقدر أي
  -- مستخدم يفتح محادثة مع أي مستخدم آخر بمجرد تمرير معرّفه — رسائل غير
  -- مطلوبة لأي شخص بالمنصة، لا تواصلاً مع متجر.
  if not exists (
    select 1 from sellers s
     where s.id = p_seller_id and s.verification_status = 'approved'
  ) then
    raise exception 'الطرف الآخر ليس بائعًا معتمدًا';
  end if;

  if p_deal_id is not null then
    insert into chat_threads(deal_id, buyer_id, seller_id, subject, last_message_at)
    values (p_deal_id, p_buyer_id, p_seller_id, coalesce(p_subject, 'محادثة صفقة'), coalesce((select created_at from deals where id = p_deal_id), now()))
    on conflict (deal_id) where deal_id is not null do update set subject = excluded.subject
    returning id into out_id;
    return out_id;
  end if;

  if p_listing_id is not null then
    -- نختار العنوان من listing لو متوفر
    the_subject := coalesce(p_subject, (select 'استفسار حول: ' || title from listings where id = p_listing_id));
    insert into chat_threads(listing_id, buyer_id, seller_id, subject, last_message_at)
    values (p_listing_id, p_buyer_id, p_seller_id, the_subject, now())
    on conflict (buyer_id, seller_id, listing_id) where listing_id is not null do update set subject = excluded.subject
    returning id into out_id;
    return out_id;
  end if;

  -- بدون listing/deal: محادثة عامة بين الطرفين
  the_subject := coalesce(p_subject, 'محادثة خاصة');
  insert into chat_threads(buyer_id, seller_id, subject, last_message_at)
  values (p_buyer_id, p_seller_id, the_subject, now())
  on conflict (buyer_id, seller_id) where listing_id is null and deal_id is null do update set subject = excluded.subject
  returning id into out_id;
  return out_id;
end; $$;
grant execute on function chat_upsert_thread(uuid,bigint,uuid,uuid,text) to authenticated;


-- ============================================================
-- 00000000000046_silent_bidding
-- ============================================================

-- ============================================================
-- نظام العروض المضادة (Best Offer / Silent Bidding)
-- ============================================================

create table if not exists listing_offers (
  id bigserial primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  offerer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  offer_price_sar numeric(12,2) not null check (offer_price_sar > 0),
  message text,
  status text not null default 'pending'
    check (status in (
      'pending', 'accepted', 'rejected', 'countered', 'expired', 'cancelled', 'deal_created'
    )),
  counter_price_sar numeric(12,2) check (counter_price_sar is null or counter_price_sar > 0),
  counter_message text,
  valid_until timestamptz not null default (now() + interval '24 hours'),
  counter_valid_until timestamptz,
  auto_expired_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  countered_at timestamptz,
  cancelled_at timestamptz,
  deal_id bigint references deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (offerer_id <> seller_id)
);

create index if not exists offers_seller_idx on listing_offers(seller_id, status, created_at desc);
create index if not exists offers_buyer_idx on listing_offers(offerer_id, status, created_at desc);
create index if not exists offers_listing_idx on listing_offers(listing_id, status);
create index if not exists offers_expire_idx on listing_offers(status, valid_until)
  where status in ('pending', 'countered');

alter table listing_offers enable row level security;

drop policy if exists "offers parties see their own" on listing_offers;
create policy "offers parties see their own"
  on listing_offers for select using (auth.uid() = offerer_id or auth.uid() = seller_id);

drop policy if exists "offerer inserts offers" on listing_offers;
create policy "offerer inserts offers"
  on listing_offers for insert with check (
    auth.uid() = offerer_id and
    status = 'pending' and
    deal_id is null and
    counter_price_sar is null and
    exists (
      select 1 from listings l where l.id = listing_id and l.status = 'published'
    ) and
    not exists (
      select 1 from listing_offers x
      where x.listing_id = listing_offers.listing_id
        and x.offerer_id = listing_offers.offerer_id
        and x.status = 'pending'
        and x.created_at > now() - interval '15 minutes'
    )
  );

-- طرفا العرض يعدّلانه؛ التحويلات المسموحة يفرضها المشغّل أدناه لا
-- السياسة، لأن WITH CHECK ما يرى الصف قبل التعديل (old/new صياغة
-- مشغّلات لا سياسات، وكتابتها هنا تُفشل الهجرة عند التطبيق).
drop policy if exists "offerer cancels pending offers" on listing_offers;
drop policy if exists "seller responds to offers" on listing_offers;
drop policy if exists "offer parties update" on listing_offers;
create policy "offer parties update"
  on listing_offers for update
  using (auth.uid() = offerer_id or auth.uid() = seller_id)
  with check (auth.uid() = offerer_id or auth.uid() = seller_id);

grant select, insert on listing_offers to authenticated;

-- مفاتيح العرض غير قابلة لإعادة الكتابة. السحب على مستوى الجدول أولاً،
-- وإلا بقي منح الجدول ساريًا وما نفع حجب العمود.
revoke update on listing_offers from authenticated;
grant update (
  status, counter_price_sar, counter_message, counter_valid_until,
  accepted_at, rejected_at, countered_at, cancelled_at, deal_id, updated_at
) on listing_offers to authenticated;

create or replace function listing_offers_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.status is not distinct from old.status then return new; end if;
  if v_uid is null or is_admin() then return new; end if;

  if v_uid = old.offerer_id then
    if not (old.status in ('pending', 'countered') and new.status = 'cancelled') then
      raise exception 'مقدّم العرض يقدر يلغي عرضه المعلّق فقط';
    end if;
  elsif v_uid = old.seller_id then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'rejected', 'countered')) or
      (old.status = 'countered' and new.status in ('accepted', 'rejected'))
    ) then
      raise exception 'تحويل حالة غير مسموح للبائع: % → %', old.status, new.status;
    end if;
  else
    raise exception 'لست طرفًا في هذا العرض';
  end if;

  return new;
end; $$;

drop trigger if exists listing_offers_guard_trigger on listing_offers;
create trigger listing_offers_guard_trigger before update on listing_offers
  for each row execute function listing_offers_guard();

-- دالة: عدد العروض الواردة للبائع حسب الحالة
create or replace function seller_offers_summary(p_seller_id uuid)
returns table (
  pending_count bigint,
  countered_count bigint,
  today_received bigint,
  total_received bigint,
  accepted_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and status = 'pending'), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and status = 'countered'), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and created_at > now() - interval '1 day'), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and status in ('accepted', 'deal_created')), 0)::bigint;
end; $$;
grant execute on function seller_offers_summary(uuid) to anon, authenticated;

-- دالة: التحقق التلقائي من انتهاء صلاحية العروض
create or replace function expire_stale_offers()
returns table (expired_count bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cnt bigint;
begin
  with expired_rows as (
    update listing_offers
    set status = 'expired',
        auto_expired_at = now(),
        updated_at = now()
    where status in ('pending', 'countered')
      and valid_until < now()
      and (counter_valid_until is null or counter_valid_until < now())
    returning 1
  ) select count(*) into cnt from expired_rows;
  expired_count := cnt;
  return next;
end; $$;
grant execute on function expire_stale_offers() to authenticated, service_role;

-- Trigger: set updated_at + حالة قبول تحديث التواريخ
create or replace function listing_offers_set_timestamps()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'accepted' and old.status <> 'accepted' then new.accepted_at = now(); end if;
  if new.status = 'rejected' and old.status <> 'rejected' then new.rejected_at = now(); end if;
  if new.status = 'countered' and old.status <> 'countered' then new.countered_at := now(); end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then new.cancelled_at := now(); end if;
  return new;
end; $$;

drop trigger if exists listing_offers_ts_trigger on listing_offers;
create trigger listing_offers_ts_trigger before update on listing_offers
  for each row execute function listing_offers_set_timestamps();


-- ============================================================
-- 00000000000047_payment_proofs
-- ============================================================

-- ============================================================
-- إيصالات الدفع والتحويل البنكي عبر Supabase Storage
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- قراءة إيصالات الدفع: فقط طرفي الصفقة + الأدمن
drop policy if exists "payment_proofs parties read" on storage.objects;
create policy "payment_proofs parties read" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (
      -- {deal_id}/{buyer_id|seller_id}/{...}  —  أولاً نسمح للـ service_role بالوصول إذا ما استدعيته
      -- لكن ك authenticated (جلسة المستخدم) نتحقق عبر الاستعلام:
      exists (
        select 1 from deals d
        where  d.id::text = (storage.foldername(name))[1]
          and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
      )
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

drop policy if exists "payment_proofs buyer/seller upload their own proof" on storage.objects;
create policy "payment_proofs buyer/seller upload their own proof" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from deals d
      where d.id::text = (storage.foldername(name))[1]
        and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
        and d.status in ('pending', 'accepted', 'buyer_confirmed')
    )
  );

drop policy if exists "payment_proofs owner delete" on storage.objects;
create policy "payment_proofs owner delete" on storage.objects
  for delete using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create table if not exists deal_payments (
  id bigserial primary key,
  deal_id bigint not null references deals(id) on delete cascade,
  submitted_by uuid not null references profiles(id) on delete cascade,
  paid_by_buyer boolean not null default false,
  payment_method text not null check (payment_method in ('bank_transfer','stc_pay','cash_on_delivery','other')),
  amount_sar numeric(12,2) not null check (amount_sar > 0),
  reference_number text,
  bank_name text,
  transfer_date date,
  payer_account_last4 text,
  proof_storage_path text,
  proof_mime_type text,
  proof_filename text,
  proof_size_bytes bigint,
  notes text,
  verified_at timestamptz,
  verified_by uuid references profiles(id) on delete set null,
  verification_notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'verified', 'rejected', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_by_buyer = true or (paid_by_buyer = false and true))
);

create index if not exists deal_payments_deal_idx on deal_payments(deal_id, created_at desc);
create index if not exists deal_payments_user_idx on deal_payments(submitted_by, created_at desc);
create index if not exists deal_payments_status_idx on deal_payments(status) where status <> 'verified';

alter table deal_payments enable row level security;

drop policy if exists "deal_payments parties read" on deal_payments;
create policy "deal_payments parties read"
  on deal_payments for select using (
    submitted_by = auth.uid() or
    exists (
      select 1 from deals d
      where d.id = deal_id and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
    )
  );

drop policy if exists "deal_payments party insert" on deal_payments;
create policy "deal_payments party insert"
  on deal_payments for insert with check (
    submitted_by = auth.uid() and
    status = 'submitted' and
    verified_at is null and
    verified_by is null and
    exists (
      select 1 from deals d
      where d.id = deal_id
        and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
        and d.status in ('pending', 'accepted', 'buyer_confirmed')
    )
  );

-- مقدّم الإثبات يقدر يلغيه أو يعدّل ملاحظته فقط. المبلغ وطريقة الدفع
-- والمرجع تُثبَّت بحجب على مستوى العمود لا بـWITH CHECK، لأن التعبير
-- هنا ما يرى الصف قبل التعديل (old/new صياغة مشغّلات لا سياسات).
drop policy if exists "deal_payments uploader can cancel or edit notes" on deal_payments;
create policy "deal_payments uploader can cancel or edit notes"
  on deal_payments for update
  using (submitted_by = auth.uid())
  with check (
    submitted_by = auth.uid()
    and status in ('submitted', 'cancelled')
  );

drop policy if exists "deal_payments admin verify" on deal_payments;
create policy "deal_payments admin verify"
  on deal_payments for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select, insert on deal_payments to authenticated;

-- السحب على مستوى الجدول أولاً ثم المنح على الأعمدة المسموحة — حجب
-- عمود مع بقاء منح الجدول لا أثر له في Postgres.
-- ملاحظة: أعمدة التحقق (verified_at/verified_by/verification_notes) غير
-- ممنوحة هنا، فالإدارة تكتبها عبر service role لا عبر سياسة الأدمن.
revoke update on deal_payments from authenticated;
grant update (status, notes, updated_at) on deal_payments to authenticated;

-- Trigger: set updated_at
create or replace function deal_payments_set_ts() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists deal_payments_ts_trigger on deal_payments;
create trigger deal_payments_ts_trigger before update on deal_payments
  for each row execute function deal_payments_set_ts();

-- Trigger: عند إدخال دفع جديد، إرسال إشعار للطرف الآخر
create or replace function deal_payments_notify() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  other_party uuid;
  link_path text;
  am_buyer boolean;
begin
  if tg_op <> 'INSERT' then return new; end if;
  select (case when new.submitted_by = d.buyer_id then d.seller_id else d.buyer_id end),
         (new.submitted_by = d.buyer_id)
  into other_party, am_buyer
  from deals d where d.id = new.deal_id;

  link_path := am_buyer ? '/dashboard/deals' : '/my/deals';

  begin
    perform notify(
      other_party,
      'payment_received',
      'إيصال دفع جديد مرفوع',
      format('%s رفع إيصال بقيمة %s ر.س على الصفقة #%s',
        case when am_buyer then 'المشتري' else 'البائع' end,
        to_char(new.amount_sar, 'FM999G999G999'),
        new.deal_id),
      link_path || '?focus=' || new.deal_id::text
    );
  exception when others then null;
  end;
  return new;
end; $$;

drop trigger if exists deal_payments_notify_trigger on deal_payments;
create trigger deal_payments_notify_trigger after insert on deal_payments
  for each row execute function deal_payments_notify();


-- ============================================================
-- 00000000000048_vouch_endorsements
-- ============================================================

-- ============================================================
-- تطوير نظام التوصيات (Vouches) + Endorsements
-- إضافة أعمدة جديدة للتعليق والعلاقة + عرض آخر الشهادات
-- ============================================================

alter table vouches add column if not exists comment text check (char_length(coalesce(comment, '')) <= 400);
alter table vouches add column if not exists relation text
  check (relation is null or relation in (
    'customer', 'neighbour', 'family', 'friend', 'repeated_customer', 'service_provider', 'other'
  ));
alter table vouches add column if not exists updated_at timestamptz not null default now();

create or replace function vouches_set_updated() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists vouches_updated_trigger on vouches;
create trigger vouches_updated_trigger before update on vouches
  for each row execute function vouches_set_updated();

-- سحب آخر N شهادة لصفحة البائع (مع اسم الشخص + صورة إن وجدت)
create or replace function seller_vouch_feed(p_seller_id uuid, p_limit int default 20)
returns table (
  id bigint,
  created_at timestamptz,
  comment text,
  relation text,
  voucher_id uuid,
  voucher_full_name text,
  voucher_avatar text,
  voucher_trust text,
  trust_label text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    v.id,
    v.created_at,
    v.comment,
    v.relation,
    v.voucher_id,
    coalesce(p.full_name, 'جارٍ في الزلفي')::text,
    coalesce(m.avatar_url, '')::text,
    coalesce(p.trust_level::text, '0'),
    case
      when coalesce(p.trust_level, 0)::int >= 3 then 'موصى به في الحي'
      when coalesce(p.trust_level, 0)::int >= 2 then 'موثّق'
      when coalesce(p.trust_level, 0)::int >= 1 then 'حساب جديد موثّق'
      else 'عضو مجتمع'
    end::text
  from vouches v
  left join profiles p on p.id = v.voucher_id
  left join profiles_meta m on m.profile_id = v.voucher_id
  where v.seller_id = p_seller_id
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end; $$;
grant execute on function seller_vouch_feed(uuid, int) to anon, authenticated;

-- دالة: صار الموصّي له صلاحية تعديل تعليقه فقط خلال 30 يومًا
drop policy if exists "voucher updates own within 30d" on vouches;
create policy "voucher updates own within 30d"
  on vouches for update using (
    voucher_id = auth.uid()
    and created_at > now() - interval '30 days'
  ) with check (
    voucher_id = auth.uid()
    and created_at > now() - interval '30 days'
    and seller_id = seller_id
    and voucher_id = voucher_id
  );
grant update on vouches to authenticated;

-- ملخص سريع للبائع (للكروت في البحث)
create or replace function seller_endorsement_summary(p_seller_id uuid)
returns table (
  vouch_count bigint,
  with_comment_count bigint,
  latest_vouch_at timestamptz,
  top_relation text,
  last_comment text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with rel_counts as (
    select coalesce(relation, 'customer') as r, count(*) as c
    from vouches
    where seller_id = p_seller_id
    group by 1
    order by 2 desc
    limit 1
  )
  select
    (select count(*) from vouches where seller_id = p_seller_id)::bigint,
    (select count(*) from vouches where seller_id = p_seller_id and comment is not null and char_length(comment) > 0)::bigint,
    (select max(created_at) from vouches where seller_id = p_seller_id),
    (select r from rel_counts limit 1),
    (select comment from vouches where seller_id = p_seller_id and comment is not null order by created_at desc limit 1);
end; $$;
grant execute on function seller_endorsement_summary(uuid) to anon, authenticated;


-- ============================================================
-- 00000000000049_milestone_badges
-- ============================================================

-- ============================================================
-- دوال حساب معايير شارات الإنجاز (Milestone Badges)
-- ============================================================

create or replace function seller_milestone_metrics(p_seller_id uuid)
returns table (
  total_listings_published bigint,
  avg_images_per_listing numeric,
  avg_first_reply_minutes_last10 numeric,
  read_rate_last10 numeric,
  vouch_count bigint,
  completed_deals bigint,
  completed_last30d bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_total bigint;
  v_images_sum bigint;
  v_avg_img numeric;
  v_vouch bigint;
  v_comp bigint;
  v_last30 bigint;
  v_reply_avg numeric;
  v_read_rate numeric;
begin
  -- Listings + avg images
  select count(*), coalesce(sum(image_count), 0)
    into v_total, v_images_sum
    from (
      select l.id,
        (select count(*) from listing_images li where li.listing_id = l.id) as image_count
      from listings l
      where l.seller_id = p_seller_id and l.status = 'published'
    ) q;
  if v_total is null then v_total := 0; end if;
  v_avg_img := case when v_total = 0 then 0 else round((v_images_sum::numeric / v_total::numeric) * 10) / 10 end;

  -- Vouch count
  select coalesce(count(*), 0) into v_vouch from vouches where seller_id = p_seller_id;

  -- Deals
  select coalesce(count(*), 0) into v_comp
    from deals
    where deals.seller_id = p_seller_id and status = 'completed';
  select coalesce(count(*), 0) into v_last30
    from deals
    where deals.seller_id = p_seller_id
      and status = 'completed'
      and completed_at > now() - interval '30 days';

  -- Chat metrics (average first reply minutes + read rate for last 10 threads with the seller as one side)
  select coalesce(avg(first_reply_minutes), 0)::numeric,
         coalesce(avg(read_rate), 0)::numeric
    into v_reply_avg, v_read_rate
    from (
      select
        t.id as thread_id,
        -- first reply from the OTHER party after the initiator's first message
        case
          when (
            select count(*) from chat_messages m where m.thread_id = t.id
          ) < 2 then null
          else extract(epoch from (
            (select m2.created_at from chat_messages m2 where m2.thread_id = t.id order by m2.created_at limit 1 offset 1)
            -
            (select m1.created_at from chat_messages m1 where m1.thread_id = t.id order by m1.created_at limit 1)
          )) / 60
        end as first_reply_minutes,
        -- fraction of unread counter that was read: since we denorm read_at per side, use a simpler heuristic
        case when t.buyer_id = p_seller_id then
          least(1, (select case when count(*) = 0 then 1 else (count(*) filter (where m.created_at <= coalesce(t.buyer_last_read_at, 'infinity'::timestamptz)))::numeric / count(*) end from chat_messages m where m.thread_id = t.id))
        else
          least(1, (select case when count(*) = 0 then 1 else (count(*) filter (where m.created_at <= coalesce(t.seller_last_read_at, 'infinity'::timestamptz)))::numeric / count(*) end from chat_messages m where m.thread_id = t.id))
        end as read_rate
      from chat_threads t
      where t.buyer_id = p_seller_id or t.seller_id = p_seller_id
      order by t.last_message_at desc nulls last
      limit 10
    ) q;

  return query select
    v_total, v_avg_img, coalesce(v_reply_avg, 0), coalesce(v_read_rate, 0), v_vouch, v_comp, v_last30;
end; $$;
grant execute on function seller_milestone_metrics(uuid) to anon, authenticated;


-- ============================================================
-- 00000000000050_seller_analytics
-- ============================================================

-- ============================================================
-- Seller Analytics / KPIs per day (مخططات SVG)
-- ============================================================

create or replace function seller_analytics_daily(p_seller_id uuid, p_days int default 30)
returns table (
  bucket_day date,
  new_listings bigint,
  new_views bigint,
  whatsapp_clicks bigint,
  new_offers_received bigint,
  new_offers_sent bigint,
  new_chats bigint,
  chat_messages_received bigint,
  new_deals bigint,
  deals_completed bigint,
  revenue_sar numeric
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  start_date date;
begin
  start_date := (now() - format('%s days', greatest(1, least(p_days, 90)))::interval)::date;

  return query
  with days as (
    select generate_series(start_date, (now())::date, '1 day'::interval)::date as d
  )
  select
    days.d::date as bucket_day,
    coalesce((select count(*) from listings l
      where l.seller_id = p_seller_id and l.status = 'published' and l.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_views lv
      where lv.seller_id = p_seller_id and lv.viewed_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_whatsapp_clicks wc
      where wc.seller_id = p_seller_id and wc.clicked_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_offers lo
      where lo.seller_id = p_seller_id and lo.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_offers lo
      where lo.offerer_id = p_seller_id and lo.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from chat_threads t
      where (t.buyer_id = p_seller_id or t.seller_id = p_seller_id) and t.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from chat_messages m
      join chat_threads t on m.thread_id = t.id
      where m.sender_id <> p_seller_id
        and (t.buyer_id = p_seller_id or t.seller_id = p_seller_id)
        and m.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from deals d
      where d.seller_id = p_seller_id and d.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from deals d
      where d.seller_id = p_seller_id and d.completed_at::date = days.d), 0)::bigint,
    coalesce((select coalesce(sum(d.price_agreed_sar), 0) from deals d
      where d.seller_id = p_seller_id and d.status = 'completed' and d.completed_at::date = days.d), 0)::numeric;
  from days
  order by days.d asc;
end; $$;
grant execute on function seller_analytics_daily(uuid, int) to authenticated;

create or replace function seller_analytics_top_listings(p_seller_id uuid, p_limit int default 5)
returns table (
  listing_id uuid,
  title text,
  slug text,
  views_last30 bigint,
  whatsapp_clicks_last30 bigint,
  offers_last30 bigint,
  chat_threads_last30 bigint,
  neighbourhood text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with base as (
    select l.id as listing_id, l.title, l.slug,
      coalesce((select count(*) from listing_views v where v.listing_id = l.id and v.viewed_at > now() - interval '30 days'), 0)::bigint as v30,
      coalesce((select count(*) from listing_whatsapp_clicks w where w.listing_id = l.id and w.clicked_at > now() - interval '30 days'), 0)::bigint as w30,
      coalesce((select count(*) from listing_offers o where o.listing_id = l.id and o.created_at > now() - interval '30 days'), 0)::bigint as o30,
      coalesce((select count(*) from chat_threads t where t.listing_id = l.id and t.created_at > now() - interval '30 days'), 0)::bigint as c30,
      l.neighbourhood
    from listings l
    where l.seller_id = p_seller_id and l.status = 'published'
  )
  select listing_id, title, slug, v30, w30, o30, c30, coalesce(neighbourhood, '—')::text
  from base
  order by (v30 + w30 * 3 + o30 * 10 + c30 * 5) desc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
end; $$;
grant execute on function seller_analytics_top_listings(uuid, int) to authenticated;

create or replace function seller_analytics_top_neighbourhoods(p_seller_id uuid)
returns table (neighbourhood text, total bigint, pct numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with agg as (
    select coalesce(l.neighbourhood, 'غير محدد') as n, count(*) as c
    from listing_views lv
    join listings l on lv.listing_id = l.id
    where lv.seller_id = p_seller_id and lv.viewed_at > now() - interval '30 days'
      and l.seller_id = p_seller_id
    group by 1
    order by 2 desc
    limit 8
  )
  select n, c,
    round((c::numeric / nullif((select sum(c) from agg), 0) * 100.0), 1)
  from agg;
end; $$;
grant execute on function seller_analytics_top_neighbourhoods(uuid) to authenticated;

create or replace function seller_analytics_funnel(p_seller_id uuid)
returns table (
  step_name text,
  step_value bigint,
  conversion_rate_from_previous numeric
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_views bigint;
  v_whatsapp bigint;
  v_offers bigint;
  v_chats bigint;
  v_deals bigint;
  v_completed bigint;
begin
  v_views     := (select coalesce(count(*), 0) from listing_views where seller_id = p_seller_id and viewed_at > now() - interval '30 days');
  v_whatsapp  := (select coalesce(count(*), 0) from listing_whatsapp_clicks where seller_id = p_seller_id and clicked_at > now() - interval '30 days');
  v_offers    := (select coalesce(count(*), 0) from listing_offers lo where lo.seller_id = p_seller_id and lo.created_at > now() - interval '30 days');
  v_chats     := (select coalesce(count(*), 0) from chat_threads t where t.seller_id = p_seller_id and t.created_at > now() - interval '30 days');
  v_deals     := (select coalesce(count(*), 0) from deals d where d.seller_id = p_seller_id and d.created_at > now() - interval '30 days');
  v_completed := (select coalesce(count(*), 0) from deals d where d.seller_id = p_seller_id and d.completed_at > now() - interval '30 days');

  return query values
    ('👀 مشاهدات الإعلانات', v_views, 100.0),
    ('💬 محادثات جديدة', v_chats, round(100.0 * v_chats::numeric / nullif(v_views, 0), 2)),
    ('💸 عروض مالية وارده', v_offers, round(100.0 * v_offers::numeric / nullif(greatest(v_chats, 1), 0), 2)),
    ('🤝 صفقات جديدة', v_deals, round(100.0 * v_deals::numeric / nullif(greatest(v_offers, 1), 0), 2)),
    ('✅ صفقات مكتملة', v_completed, round(100.0 * v_completed::numeric / nullif(greatest(v_deals, 1), 0), 2));
end; $$;
grant execute on function seller_analytics_funnel(uuid) to authenticated;


-- ============================================================
-- 00000000000051_bookings
-- ============================================================

-- ============================================================
-- نظام الحجوزات (Bookings) للخدمات — دوام البائع الأسبوعي + الحجوزات
-- ============================================================
--
-- الطرف البائع يشير إلى sellers(id) لا profiles(id): المعرّف نفسه (راجع
-- الهجرة 01)، لكنه يفرض أن الطرف بائع فعلاً، ويعطي PostgREST مسار ربط
-- مباشر لجلب business_name/slug — وهي أعمدة غير موجودة على profiles.

-- قيد exclude أدناه يخلط uuid و date (بمعامل =) مع int4range (بمعامل &&)
-- داخل فهرس GiST واحد. GiST لا يعرف = على uuid/date إلا بهذا الامتداد.
create extension if not exists btree_gist;

create table if not exists seller_availability (
  id bigserial primary key,
  seller_id uuid not null references sellers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=الأحد، 6=السبت
  start_minute smallint not null check (start_minute between 0 and 1439), -- 0 = 00:00
  end_minute smallint not null check (end_minute between 0 and 1440),
  is_closed boolean not null default false,
  slot_duration_minutes smallint not null default 60 check (slot_duration_minutes in (15, 30, 45, 60, 90, 120)),
  buffer_minutes smallint not null default 0 check (buffer_minutes between 0 and 240),
  max_parallel_bookings smallint not null default 1 check (max_parallel_bookings between 1 and 20),
  created_at timestamptz not null default now(),
  unique (seller_id, day_of_week),
  check (is_closed or end_minute > start_minute)
);

create index if not exists sched_seller_idx on seller_availability(seller_id);
alter table seller_availability enable row level security;

-- الدوام الأسبوعي معلومة عامة بطبيعتها — المشتري لازم يشوفها ليحجز.
drop policy if exists "seller_av seller read own" on seller_availability;
drop policy if exists "seller_av public read approved" on seller_availability;
drop policy if exists "seller_av public read" on seller_availability;
create policy "seller_av public read" on seller_availability for select using (true);

-- USING مطلوب هنا وليس WITH CHECK وحده: بدونه يعتبره Postgres true، فأي
-- مستخدم مسجّل يقدر يحذف دوام أي بائع (DELETE لا يفحص إلا USING).
drop policy if exists "seller_av seller manage own" on seller_availability;
create policy "seller_av seller manage own"
  on seller_availability for all
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

grant select on seller_availability to anon, authenticated;
grant insert, update, delete on seller_availability to authenticated;

create table if not exists seller_bookings (
  id bigserial primary key,
  seller_id uuid not null references sellers(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  deal_id bigint references deals(id) on delete set null,
  booking_date date not null,
  start_minute smallint not null check (start_minute between 0 and 1439),
  duration_minutes smallint not null check (duration_minutes between 15 and 480),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  customer_name text check (char_length(coalesce(customer_name, '')) <= 80),
  customer_phone text check (char_length(coalesce(customer_phone, '')) <= 30),
  service_title text check (char_length(coalesce(service_title, '')) <= 120),
  quoted_price_sar numeric(12,2) check (quoted_price_sar is null or quoted_price_sar > 0),
  notes text check (char_length(coalesce(notes, '')) <= 500),
  cancel_reason text check (char_length(coalesce(cancel_reason, '')) <= 300),
  cancelled_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> buyer_id),
  -- لا حجزين متداخلين لنفس البائع ما لم يكن أحدهما ملغى
  exclude using gist (
    seller_id with =,
    booking_date with =,
    int4range(start_minute, start_minute + duration_minutes, '[)') with &&
  ) where (status <> 'cancelled')
);

create index if not exists bookings_seller_date_idx on seller_bookings(seller_id, booking_date);
create index if not exists bookings_buyer_idx on seller_bookings(buyer_id, booking_date desc);
create index if not exists bookings_status_date_idx on seller_bookings(status, booking_date);

alter table seller_bookings enable row level security;

drop policy if exists "bookings parties read" on seller_bookings;
create policy "bookings parties read"
  on seller_bookings for select using (seller_id = auth.uid() or buyer_id = auth.uid());

drop policy if exists "bookings buyer inserts" on seller_bookings;
create policy "bookings buyer inserts"
  on seller_bookings for insert with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and status = 'pending'
    and deal_id is null
    and booking_date >= current_date
    and duration_minutes in (15, 30, 45, 60, 90, 120)
  );

-- طرفا الحجز فقط يقدران يحدّثانه. أي تحويل حالة *مسموح* يفرضه المشغّل
-- أدناه، لا هذه السياسة: تعبير WITH CHECK ما يقدر يشوف الصف قبل التعديل
-- (old/new صياغة مشغّلات لا سياسات)، فمحاولة كتابتها هنا خطأ صياغي يفشل
-- عند تطبيق الهجرة أصلاً.
drop policy if exists "bookings buyer cancels pending only" on seller_bookings;
drop policy if exists "bookings seller manage" on seller_bookings;
drop policy if exists "bookings parties update" on seller_bookings;
create policy "bookings parties update"
  on seller_bookings for update
  using (seller_id = auth.uid() or buyer_id = auth.uid())
  with check (seller_id = auth.uid() or buyer_id = auth.uid());

grant select, insert on seller_bookings to authenticated;

-- ولا يقدر أي طرف يعيد كتابة تفاصيل الحجز نفسه بعد إنشائه — حجب على
-- مستوى العمود، لأن WITH CHECK لا يثبّت عمودًا على قيمته السابقة.
-- السحب على مستوى الجدول أولاً إلزامي: في Postgres حجب عمود مع بقاء
-- منح على مستوى الجدول لا أثر له إطلاقًا (الهجرة 15 منحت update على كل
-- الجداول وجعلته الافتراضي لكل جدول لاحق).
revoke update on seller_bookings from authenticated;
grant update (status, cancel_reason, cancelled_by, quoted_price_sar, updated_at)
  on seller_bookings to authenticated;

-- ============================================================
-- تحويلات الحالة المسموحة — يفرضها مشغّل لأن السياسة لا ترى الحالة السابقة
-- ============================================================
create or replace function seller_bookings_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_is_seller boolean := (v_uid = old.seller_id);
  v_is_buyer boolean := (v_uid = old.buyer_id);
begin
  new.updated_at := now();

  if new.status is distinct from old.status then
    if v_is_seller then
      -- البائع: يقبل أو يرفض المعلّق، ويغلق المؤكّد
      if not (
        (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or
        (old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'no_show'))
      ) then
        raise exception 'تحويل حالة غير مسموح للبائع: % → %', old.status, new.status;
      end if;
    elsif v_is_buyer then
      -- المشتري: يلغي حجزه ما دام لم يُؤكَّد بعد، ولا شيء غير ذلك
      if not (old.status = 'pending' and new.status = 'cancelled') then
        raise exception 'المشتري يقدر يلغي الحجز المعلّق فقط';
      end if;
      new.cancelled_by := old.buyer_id;
    else
      raise exception 'لست طرفًا في هذا الحجز';
    end if;
  end if;

  if new.status = 'confirmed' and old.status <> 'confirmed' then new.confirmed_at := now(); end if;
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at := now(); end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := coalesce(new.cancelled_by, v_uid);
  end if;

  return new;
end; $$;

drop trigger if exists seller_bookings_ts_trigger on seller_bookings;
drop trigger if exists seller_bookings_guard_trigger on seller_bookings;
create trigger seller_bookings_guard_trigger before update on seller_bookings
  for each row execute function seller_bookings_guard();

-- ============================================================
-- الفترات المتاحة للأيام القادمة — تغذّي تقويم صفحة الحجز
-- ============================================================
create or replace function seller_free_slots(
  p_seller_id uuid,
  p_start_date date,
  p_days int default 14
)
returns table (
  slot_date date,
  start_minute smallint,
  end_minute smallint,
  is_available boolean,
  overlap_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_sched record;
  day_cursor date;
  cur_start integer;
  cur_end integer;
  slot_dur integer;
  buff integer;
  max_parallel integer;
  v_count bigint;
begin
  for day_cursor in
    select p_start_date + generate_series(0, greatest(1, least(p_days, 60)) - 1)
  loop
    -- isodow: 1=الاثنين .. 7=الأحد، والقسمة على 7 تحوّلها إلى 0=الأحد
    select * into v_sched
      from seller_availability s
     where s.seller_id = p_seller_id
       and s.day_of_week = (extract(isodow from day_cursor)::int % 7);

    if not found or v_sched.is_closed then
      continue;
    end if;

    slot_dur := coalesce(v_sched.slot_duration_minutes, 60);
    buff := coalesce(v_sched.buffer_minutes, 0);
    max_parallel := coalesce(v_sched.max_parallel_bookings, 1);

    cur_start := v_sched.start_minute;
    while cur_start + slot_dur <= v_sched.end_minute loop
      cur_end := cur_start + slot_dur;

      select coalesce(count(*), 0) into v_count
        from seller_bookings b
       where b.seller_id = p_seller_id
         and b.status <> 'cancelled'
         and b.booking_date = day_cursor
         and int4range(b.start_minute - buff, b.start_minute + b.duration_minutes + buff, '[)')
             && int4range(cur_start, cur_end, '[)');

      -- الفترات الماضية من اليوم الحالي تُعرض مشغولة لا متاحة
      slot_date := day_cursor;
      start_minute := cur_start::smallint;
      end_minute := cur_end::smallint;
      overlap_count := v_count;
      is_available := (v_count < max_parallel)
        and (day_cursor > current_date
             or cur_start > (extract(hour from now())::int * 60 + extract(minute from now())::int));
      return next;

      cur_start := cur_start + slot_dur;
    end loop;
  end loop;
  return;
end; $$;
grant execute on function seller_free_slots(uuid, date, int) to anon, authenticated;

-- ============================================================
-- عند التأكيد: تُنشأ صفقة تلقائيًا بالسعر المتفق عليه
-- ============================================================
create or replace function booking_confirmed_create_deal() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  new_deal_id bigint;
  v_from text;
  v_to text;
begin
  if old.status <> 'pending' or new.status <> 'confirmed' then return new; end if;
  if new.deal_id is not null then return new; end if;

  v_from := lpad((new.start_minute / 60)::text, 2, '0') || ':' ||
            lpad((new.start_minute % 60)::text, 2, '0');
  v_to := lpad(((new.start_minute + new.duration_minutes) / 60)::text, 2, '0') || ':' ||
          lpad(((new.start_minute + new.duration_minutes) % 60)::text, 2, '0');

  insert into deals (
    seller_id, buyer_id, listing_id, title, description,
    price_agreed_sar, status, scheduled_at
  )
  values (
    new.seller_id, new.buyer_id, new.listing_id,
    format('حجز موعد: %s - %s',
           coalesce(new.service_title, 'حجز خدمة'),
           to_char(new.booking_date, 'DD/MM/YYYY')),
    format('حجز من %s إلى %s لمدة %s دقيقة. ملاحظة: %s',
           v_from, v_to, new.duration_minutes, coalesce(new.notes, '—')),
    new.quoted_price_sar,
    'accepted',
    (new.booking_date + make_interval(mins => new.start_minute))::timestamptz
  )
  returning id into new_deal_id;

  new.deal_id := new_deal_id;
  return new;
end; $$;

drop trigger if exists booking_confirmed_deal_trigger on seller_bookings;
-- الاسم يسبق seller_bookings_guard_trigger أبجديًا، فيعمل قبله — وهذا مقصود:
-- الحارس يرفض التحويل غير المسموح، لكن هذا يقرأ old/new نفسها ولا يعتمد عليه.
create trigger booking_confirmed_deal_trigger before update on seller_bookings
  for each row execute function booking_confirmed_create_deal();

-- ============================================================
-- إشعارات طرفي الحجز
-- ============================================================
create or replace function bookings_notify() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_id uuid;
  title_str text;
  body_str text;
  the_link text;
  dt_str text;
  cancelled_by_buyer boolean;
begin
  dt_str := to_char(new.booking_date, 'DD/MM/YYYY') || ' الساعة ' ||
            lpad((new.start_minute / 60)::text, 2, '0') || ':' ||
            lpad((new.start_minute % 60)::text, 2, '0');

  if tg_op = 'INSERT' then
    title_str := '📅 طلب حجز جديد';
    body_str := format('%s حجز %s دقيقة في %s',
                       coalesce(new.service_title, 'خدمة'), new.duration_minutes, dt_str);
    the_link := '/dashboard/bookings?focus=' || new.id;
    target_id := new.seller_id;

  elsif new.status = 'confirmed' and old.status <> 'confirmed' then
    title_str := '✅ تم تأكيد حجزك';
    body_str := format('الحجز بتاريخ %s تم تأكيده من البائع.', dt_str);
    the_link := '/my/bookings?focus=' || new.id;
    target_id := new.buyer_id;

  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    cancelled_by_buyer := (coalesce(new.cancelled_by, new.buyer_id) = new.buyer_id);
    title_str := '⛔ تم إلغاء موعد حجز';
    body_str := format('الحجز بتاريخ %s أُلغي. %s', dt_str, coalesce(new.cancel_reason, ''));
    -- يُبلَّغ الطرف الآخر، لا من ألغى
    target_id := case when cancelled_by_buyer then new.seller_id else new.buyer_id end;
    the_link := case when cancelled_by_buyer
                     then '/dashboard/bookings?focus=' || new.id
                     else '/my/bookings?focus=' || new.id end;

  elsif new.status = 'completed' and old.status <> 'completed' then
    title_str := '🎉 اكتمل موعدك';
    body_str := format('موعد %s اكتمل. قيّم تجربتك مع البائع.', dt_str);
    the_link := '/my/bookings?focus=' || new.id;
    target_id := new.buyer_id;

  else
    return new;
  end if;

  -- الإشعار تحسين لا شرط: فشله ما يرجّع الحجز نفسه
  begin
    perform notify(target_id, 'booking_update', title_str, left(body_str, 200), the_link);
  exception when others then null; end;

  return new;
end; $$;

drop trigger if exists bookings_notify_trigger on seller_bookings;
create trigger bookings_notify_trigger after insert or update on seller_bookings
  for each row execute function bookings_notify();

-- deals.scheduled_at قد لا يكون موجودًا حسب ترتيب التطبيق
alter table deals add column if not exists scheduled_at timestamptz;
grant update (scheduled_at) on deals to authenticated;


-- ============================================================
-- 00000000000052_deal_feedback
-- ============================================================

-- ============================================================
-- استبيان رضا العملاء + تقييم نجوم بعد الصفقة
-- ============================================================
--
-- المشروع فيه أصلاً جدول reviews (هجرة 23) مربوط بـtransactions — نظام
-- المطالبة اليدوي القديم. هذا الجدول مربوط بـdeals (هجرة 42) وهي دورة
-- حياة مختلفة. عمدًا ما دمجناهما في جدول واحد: مفتاح المصدر مختلف
-- والقيود مختلفة. لكن `seller_rating` أدناه أُعيدت كتابتها لتجمع
-- المصدرين، حتى لا ينتهي البائع بتقييمين متنافسين في مكانين.

create table if not exists deal_feedback (
  id bigserial primary key,
  deal_id bigint not null unique references deals(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade, -- المشتري
  reviewee_id uuid not null references sellers(id) on delete cascade, -- البائع
  rating_stars smallint not null check (rating_stars between 1 and 5),
  would_recommend boolean not null default true,
  comment text check (char_length(coalesce(comment, '')) <= 600),
  created_at timestamptz not null default now(),
  check (reviewer_id <> reviewee_id)
);

create index if not exists deal_feedback_reviewee_idx
  on deal_feedback(reviewee_id, created_at desc);

alter table deal_feedback enable row level security;

-- التقييمات عامة: كارت البائع في البحث وصفحته يعرضانها.
drop policy if exists "deal_feedback public read" on deal_feedback;
create policy "deal_feedback public read" on deal_feedback for select using (true);

-- الشرط الحاسم: لا يقيّم إلا مشتري تلك الصفقة بالذات، وبعد اكتمالها.
-- القيد `unique (deal_id)` يتكفّل بـ"مرة واحدة فقط" — لا نعتمد على فحص
-- بالتطبيق يمكن تجاوزه بطلبين متزامنين.
drop policy if exists "deal_feedback buyer inserts once" on deal_feedback;
create policy "deal_feedback buyer inserts once"
  on deal_feedback for insert with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from deals d
       where d.id = deal_feedback.deal_id
         and d.buyer_id = auth.uid()
         and d.seller_id = deal_feedback.reviewee_id
         and d.status in ('buyer_confirmed', 'completed')
    )
  );

-- لا تعديل ولا حذف بعد الإرسال: تقييم قابل للتحرير بأثر رجعي ليس تقييمًا.
-- (الإدارة تتصرف عبر is_admin أدناه.)
drop policy if exists "deal_feedback admin all" on deal_feedback;
create policy "deal_feedback admin all" on deal_feedback for all using (is_admin());

grant select on deal_feedback to anon, authenticated;
grant insert on deal_feedback to authenticated;

-- ============================================================
-- متوسط تقييم البائع — يجمع reviews (23) و deal_feedback (هنا)
-- ============================================================
-- آمنة للنشر: لا ترجّع إلا تجميعات على تقييمات عامة أصلاً.
create or replace function seller_rating(p_seller_id uuid)
returns table (average numeric, total bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with all_ratings as (
    select rating::numeric as stars from reviews where seller_id = p_seller_id
    union all
    select rating_stars::numeric from deal_feedback where reviewee_id = p_seller_id
  )
  select round(avg(stars), 1), count(*) from all_ratings;
$$;
grant execute on function seller_rating(uuid) to anon, authenticated;

-- نسبة من يوصون بالبائع — تُعرض بجانب النجوم لأن "٤.٨" وحدها لا تقول
-- هل يعاود العميل التعامل أم لا.
create or replace function seller_recommend_rate(p_seller_id uuid)
returns table (recommend_pct int, sample_size bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    case when count(*) = 0 then null
         else round(100.0 * count(*) filter (where would_recommend) / count(*))::int
    end,
    count(*)
  from deal_feedback
  where reviewee_id = p_seller_id;
$$;
grant execute on function seller_recommend_rate(uuid) to anon, authenticated;

-- آخر التقييمات لعرضها في صفحة البائع
create or replace function seller_recent_feedback(p_seller_id uuid, p_limit int default 20)
returns table (
  id bigint,
  rating_stars smallint,
  would_recommend boolean,
  comment text,
  reviewer_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select f.id, f.rating_stars, f.would_recommend, f.comment,
         coalesce(p.full_name, 'عميل'), f.created_at
    from deal_feedback f
    left join profiles p on p.id = f.reviewer_id
   where f.reviewee_id = p_seller_id
   order by f.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;
grant execute on function seller_recent_feedback(uuid, int) to anon, authenticated;

-- هل يحق للمستخدم الحالي تقييم هذه الصفقة؟ نفس شرط سياسة الإدراج،
-- معروضًا للواجهة حتى لا تظهر نموذجًا سيُرفض.
create or replace function can_review_deal(p_deal_id bigint)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from deals d
     where d.id = p_deal_id
       and d.buyer_id = auth.uid()
       and d.status in ('buyer_confirmed', 'completed')
       and not exists (select 1 from deal_feedback f where f.deal_id = d.id)
  );
$$;
grant execute on function can_review_deal(bigint) to authenticated;

-- ============================================================
-- عند اكتمال الصفقة: ادعُ المشتري للتقييم
-- ============================================================
create or replace function deal_completed_ask_feedback() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status not in ('buyer_confirmed', 'completed') then return new; end if;
  if old.status in ('buyer_confirmed', 'completed') then return new; end if;
  if exists (select 1 from deal_feedback f where f.deal_id = new.id) then return new; end if;

  begin
    perform notify(
      new.buyer_id,
      'deal_feedback_request',
      '⭐ قيّم تجربتك',
      left(format('كيف كانت تجربتك في «%s»؟ ٣٠ ثانية فقط.',
                  coalesce(new.title, 'الصفقة')), 200),
      '/my/deals?review=' || new.id
    );
  exception when others then null; end;

  return new;
end; $$;

drop trigger if exists deal_completed_feedback_trigger on deals;
create trigger deal_completed_feedback_trigger after update on deals
  for each row execute function deal_completed_ask_feedback();

-- إشعار البائع بوصول تقييم جديد
create or replace function deal_feedback_notify_seller() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    perform notify(
      new.reviewee_id,
      'deal_feedback_received',
      format('%s وصلك تقييم جديد', repeat('⭐', new.rating_stars)),
      left(coalesce(nullif(trim(new.comment), ''), 'بدون تعليق'), 200),
      '/dashboard/deals'
    );
  exception when others then null; end;
  return new;
end; $$;

drop trigger if exists deal_feedback_notify_trigger on deal_feedback;
create trigger deal_feedback_notify_trigger after insert on deal_feedback
  for each row execute function deal_feedback_notify_seller();

-- notify() هي SECURITY DEFINER وتكتب في صندوق مستخدم آخر — تُستدعى من
-- المشغّلات فقط. (الحجب مطبّق أصلاً في الهجرة 28؛ مكرّر هنا لأن الهجرات
-- تُطبَّق أحيانًا مفردة.)
revoke all on function notify(uuid, text, text, text, text) from anon, authenticated;


-- ============================================================
-- 00000000000053_fix_column_revokes
-- ============================================================

-- ============================================================
-- إصلاح حجب الأعمدة — كان معطّلاً بالكامل عبر المشروع
-- ============================================================
--
-- المشروع يعتمد على نمط `revoke update (col) on t from authenticated`
-- في 14 موضعًا (الهجرات 15، 23، 24، 26، 27، 28، 29، 30، 31، 32) لتثبيت
-- أعمدة لا يجوز للمستخدم إعادة كتابتها — لأن WITH CHECK لا يقدر يثبّت
-- عمودًا على قيمته السابقة.
--
-- لكن هذا النمط لا يعمل. توثيق Postgres صريح:
--
--   "if a role has been granted privileges on a table, then revoking the
--    same privileges from individual columns will have no effect."
--
-- والهجرة 15 منحت `grant select, insert, update, delete on all tables`
-- على مستوى الجدول، وجعلتها الافتراضي لكل جدول لاحق. فكل revoke على
-- مستوى العمود بعدها أطلق تحذيرًا ومرّ بلا أثر:
--
--   البائع يقدر يرفع verification_status لنفسه إلى approved
--   البائع يقدر يرفع free_listing_limit و referral_bonus_slots لنفسه
--   البائع يقدر يعلّم إعلانه is_featured بدون دفع
--   أي مستخدم يقدر يزرع إشعارًا بعنوان ورابط من اختياره في صندوقه
--   صاحب السؤال يقدر ينشر سؤاله بنفسه متجاوزًا مراجعة الإدارة
--
-- الترتيب الصحيح: اسحب الصلاحية على مستوى الجدول أولاً، ثم امنحها على
-- الأعمدة المسموحة فقط. الكتلة أدناه تفعل ذلك اشتقاقًا من
-- information_schema، فلا تحتاج تعداد الأعمدة يدويًا ولا تنكسر لو أُضيف
-- عمود جديد لاحقًا — العمود الجديد يُمنح تلقائيًا ما لم يُدرج بالقائمة.

do $$
declare
  -- الجدول -> الأعمدة المحجوبة عن التعديل من authenticated
  protected jsonb := jsonb_build_object(
    'listings',      jsonb_build_array('id', 'seller_id', 'is_featured', 'created_at'),
    'sellers',       jsonb_build_array('id', 'verification_status', 'free_listing_limit',
                                       'identity_verified', 'referral_code',
                                       'referral_bonus_slots', 'last_active_at', 'created_at'),
    'transactions',  jsonb_build_array('id', 'buyer_id', 'seller_id', 'listing_id', 'created_at'),
    'offers',        jsonb_build_array('id', 'status', 'seller_id', 'created_at'),
    'questions',     jsonb_build_array('id', 'status', 'author_id', 'answer_count', 'created_at'),
    'answers',       jsonb_build_array('id', 'status', 'author_id', 'question_id', 'created_at'),
    'notifications', jsonb_build_array('id', 'user_id', 'type', 'title', 'body', 'link', 'created_at'),
    'events',        jsonb_build_array('id', 'status', 'created_by', 'created_at'),
    'jobs',          jsonb_build_array('id', 'seller_id', 'created_at'),
    'deals',         jsonb_build_array('id', 'listing_id', 'seller_id', 'buyer_id',
                                       'price_agreed_sar', 'created_at', 'accepted_at',
                                       'completed_at', 'disputed_at', 'rejected_at', 'cancelled_at'),
    'seller_bookings', jsonb_build_array('id', 'seller_id', 'buyer_id', 'listing_id', 'deal_id',
                                         'booking_date', 'start_minute', 'duration_minutes',
                                         'customer_name', 'customer_phone', 'service_title',
                                         'notes', 'created_at', 'confirmed_at',
                                         'completed_at', 'cancelled_at')
  );
  tbl text;
  cols text;
begin
  for tbl in select jsonb_object_keys(protected) loop
    -- الجدول قد لا يكون موجودًا لو طُبّقت الهجرات جزئيًا
    if to_regclass('public.' || quote_ident(tbl)) is null then
      continue;
    end if;

    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
      into cols
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = tbl
       and not (protected -> tbl ? c.column_name);

    -- اسحب على مستوى الجدول أولاً، وإلا ما نفع المنح على مستوى العمود
    execute format('revoke update on public.%I from authenticated', tbl);

    if cols is not null then
      execute format('grant update (%s) on public.%I to authenticated', cols, tbl);
    end if;
  end loop;
end $$;

-- تحقّق: هذا الاستعلام لازم يرجّع صفرًا بعد التطبيق. لو رجّع صفوفًا،
-- فأحد الأعمدة الحساسة ما زال قابلاً للتعديل.
--
--   select table_name, column_name
--     from information_schema.column_privileges
--    where grantee = 'authenticated' and privilege_type = 'UPDATE'
--      and (table_name, column_name) in (
--        ('sellers', 'verification_status'), ('sellers', 'free_listing_limit'),
--        ('sellers', 'referral_bonus_slots'), ('listings', 'is_featured'),
--        ('notifications', 'title'), ('notifications', 'link'),
--        ('questions', 'status'), ('deals', 'price_agreed_sar')
--      );

