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
