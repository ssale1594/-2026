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
