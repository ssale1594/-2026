-- Initial schema for the Al-Zulfi local marketplace platform
-- Based on decisions documented in TECH.md (Supabase/Postgres, JSONB listing details,
-- region_id from day one for future multi-town expansion).

create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- ============================================================
-- Regions & neighborhoods (multi-tenant from day one)
-- ============================================================

create table regions (
  id serial primary key,
  name text not null,
  slug text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into regions (name, slug) values ('الزلفي', 'al-zulfi');

create table neighborhoods (
  id serial primary key,
  region_id int references regions(id) not null,
  name_ar text not null,
  slug text not null,
  created_at timestamptz default now(),
  unique (region_id, slug)
);

-- ============================================================
-- Profiles & sellers
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  full_name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sellers (
  id uuid primary key references profiles(id) on delete cascade,
  region_id int references regions(id) not null default 1,
  business_name text not null,
  business_type text check (business_type in ('shop', 'home_producer', 'service_provider', 'real_estate_agent', 'individual')),
  slug text unique not null,
  description text,
  logo_url text,
  whatsapp_number text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  free_listing_limit int not null default 8,
  active_listings_count int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on sellers (region_id);

-- ============================================================
-- Categories
-- ============================================================

create table categories (
  id serial primary key,
  parent_id int references categories(id),
  name_ar text not null,
  slug text unique not null,
  listing_type text not null check (listing_type in ('product', 'service', 'real_estate', 'used_item')),
  icon text,
  sort_order int default 0,
  is_active boolean default true
);

-- ============================================================
-- Listings (unified table, JSONB for type-specific fields — see TECH.md §2)
-- ============================================================

create table listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id) on delete cascade not null,
  region_id int references regions(id) not null default 1,
  category_id int references categories(id) not null,
  neighborhood_id int references neighborhoods(id),
  listing_type text not null check (listing_type in ('product', 'service', 'real_estate', 'used_item')),

  title text not null,
  slug text not null,
  description text,
  price numeric(12, 2),
  price_negotiable boolean default false,

  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'paused', 'expired', 'archived')),
  is_featured boolean default false,

  details jsonb not null default '{}',

  -- normalized search column, kept in sync by trigger below
  search_text text,

  view_count int not null default 0,
  contact_click_count int not null default 0,

  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_listings_status_category on listings (status, category_id);
create index idx_listings_seller on listings (seller_id, status);
create index idx_listings_price on listings (price) where price is not null;
create index idx_listings_details_gin on listings using gin (details);
create index idx_listings_search_trgm on listings using gin (search_text gin_trgm_ops);

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade not null,
  storage_path text not null,
  sort_order int default 0,
  is_primary boolean default false,
  created_at timestamptz default now()
);

create index on listing_images (listing_id);

-- ============================================================
-- Subscriptions & payments
-- ============================================================

create table plans (
  id serial primary key,
  name text not null,
  monthly_price numeric(10, 2),
  yearly_price numeric(10, 2),
  free_listing_limit int not null default 8,
  is_active boolean default true
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id) on delete cascade not null,
  plan_id int references plans(id),
  provider text not null check (provider in ('tap', 'moyasar')),
  provider_subscription_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on subscriptions (seller_id, status);

create table payments (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id) not null,
  subscription_id uuid references subscriptions(id),
  provider text not null check (provider in ('tap', 'moyasar')),
  provider_payment_id text,
  amount numeric(10, 2) not null,
  currency text not null default 'SAR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Webhook idempotency (see TECH.md §7 — a payment/renewal webhook may arrive more than once)
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamptz default now(),
  unique (provider, event_id)
);

-- ============================================================
-- Contact click analytics (WhatsApp button tracking — TECH.md §9)
-- ============================================================

create table contact_clicks (
  id bigserial primary key,
  listing_id uuid references listings(id) on delete cascade not null,
  clicked_at timestamptz default now()
);

create index on contact_clicks (listing_id);

-- ============================================================
-- Triggers: updated_at maintenance
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_sellers_updated_at before update on sellers
  for each row execute function set_updated_at();
create trigger trg_listings_updated_at before update on listings
  for each row execute function set_updated_at();
create trigger trg_subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

-- ============================================================
-- Trigger: Arabic search text normalization (TECH.md §3 — أ/إ/آ, ة/ه unification)
-- ============================================================

create or replace function normalize_arabic(input text)
returns text as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[إأآا]', 'ا', 'g'),
      'ة', 'ه', 'g'
    ),
    '[ً-ْ]', '', 'g' -- strip Arabic diacritics (tashkeel)
  );
$$ language sql immutable;

create or replace function set_listing_search_text()
returns trigger as $$
begin
  new.search_text = normalize_arabic(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  return new;
end;
$$ language plpgsql;

create trigger trg_listings_search_text before insert or update of title, description on listings
  for each row execute function set_listing_search_text();

-- ============================================================
-- Trigger: keep sellers.active_listings_count in sync (TECH.md §6)
-- ============================================================

create or replace function update_seller_listing_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' and new.status = 'published' then
    update sellers set active_listings_count = active_listings_count + 1 where id = new.seller_id;
  elsif tg_op = 'DELETE' and old.status = 'published' then
    update sellers set active_listings_count = active_listings_count - 1 where id = old.seller_id;
  elsif tg_op = 'UPDATE' and old.status = 'published' and new.status != 'published' then
    update sellers set active_listings_count = active_listings_count - 1 where id = new.seller_id;
  elsif tg_op = 'UPDATE' and old.status != 'published' and new.status = 'published' then
    update sellers set active_listings_count = active_listings_count + 1 where id = new.seller_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger trg_listing_count
  after insert or update or delete on listings
  for each row execute function update_seller_listing_count();

-- ============================================================
-- Function: enforce the free-tier listing limit server-side (TECH.md §6)
-- ============================================================

create or replace function can_create_listing(p_seller_id uuid)
returns boolean as $$
declare
  v_limit int;
  v_active_count int;
  v_has_active_subscription boolean;
begin
  select free_listing_limit, active_listings_count
    into v_limit, v_active_count
    from sellers where id = p_seller_id;

  select exists(
    select 1 from subscriptions
    where seller_id = p_seller_id
      and status = 'active'
      and current_period_end > now()
  ) into v_has_active_subscription;

  if v_has_active_subscription then
    return true;
  end if;

  return v_active_count < v_limit;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table sellers enable row level security;
alter table listings enable row level security;
alter table listing_images enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table contact_clicks enable row level security;

-- Profiles: user reads/updates their own profile only
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Sellers: public can read approved sellers; owner can read/update their own row
create policy "sellers_select_public" on sellers for select using (verification_status = 'approved');
create policy "sellers_select_own" on sellers for select using (auth.uid() = id);
create policy "sellers_update_own" on sellers for update using (auth.uid() = id);
create policy "sellers_insert_own" on sellers for insert with check (auth.uid() = id);

-- Listings: public can read published listings; seller manages their own
create policy "listings_select_public" on listings for select using (status = 'published');
create policy "listings_select_own" on listings for select using (
  seller_id = auth.uid()
);
create policy "listings_insert_own" on listings for insert with check (
  seller_id = auth.uid() and can_create_listing(auth.uid())
);
create policy "listings_update_own" on listings for update using (seller_id = auth.uid());
create policy "listings_delete_own" on listings for delete using (seller_id = auth.uid());

-- Listing images: follow the parent listing's visibility
create policy "listing_images_select" on listing_images for select using (
  exists (select 1 from listings l where l.id = listing_id and (l.status = 'published' or l.seller_id = auth.uid()))
);
create policy "listing_images_manage_own" on listing_images for all using (
  exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())
);

-- Subscriptions & payments: seller sees only their own
create policy "subscriptions_select_own" on subscriptions for select using (seller_id = auth.uid());
create policy "payments_select_own" on payments for select using (seller_id = auth.uid());

-- Contact clicks: insert-only from clients, no public read (admin/service-role reads for analytics)
create policy "contact_clicks_insert" on contact_clicks for insert with check (true);

-- Admin override: any authenticated admin can do anything (checked via profiles.role)
create policy "admin_all_profiles" on profiles for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "admin_all_sellers" on sellers for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "admin_all_listings" on listings for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
