-- ============================================================
-- نظام العروض المضادة (Best Offer / Silent Bidding)
-- ============================================================

create table if not exists listing_offers (
  id bigserial primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  offerer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
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

drop policy if exists "offerer cancels pending offers" on listing_offers;
create policy "offerer cancels pending offers"
  on listing_offers for update using (
    auth.uid() = offerer_id
  ) with check (
    auth.uid() = offerer_id and
    old.status in ('pending', 'countered') and
    new.status in ('cancelled')
    and new.offer_price_sar = old.offer_price_sar
    and new.listing_id = old.listing_id
    and new.offerer_id = old.offerer_id
    and new.seller_id = old.seller_id
    and new.counter_price_sar is not distinct from old.counter_price_sar
  );

drop policy if exists "seller responds to offers" on listing_offers;
create policy "seller responds to offers"
  on listing_offers for update using (auth.uid() = seller_id) with check (
    auth.uid() = seller_id and
    -- immutable keys
    new.offer_price_sar = old.offer_price_sar and
    new.listing_id = old.listing_id and
    new.offerer_id = old.offerer_id and
    new.seller_id = old.seller_id and
    (
      (old.status = 'pending' and new.status in ('accepted', 'rejected', 'countered')) or
      (old.status = 'countered' and new.status in ('accepted', 'rejected'))
    )
  );

grant select, insert, update on listing_offers to authenticated;

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
