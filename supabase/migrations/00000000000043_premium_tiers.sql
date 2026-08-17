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

drop policy if exists "seller self-updates only permitted fields" on seller_subscriptions;
create policy "seller self-updates only permitted fields"
  on seller_subscriptions for update using (auth.uid() = seller_id) with check (
    auth.uid() = seller_id and
    new.tier = old.tier and
    new.active_listing_limit = old.active_listing_limit and
    new.can_featured_ad = old.can_featured_ad and
    new.featured_quota_monthly = old.featured_quota_monthly and
    new.premium_badge_level = old.premium_badge_level and
    new.amount_paid_sar = old.amount_paid_sar and
    new.status = old.status
    -- فقط auto_renew و cancellation_reason يُسمح بالتعديل من البائع
  );

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
