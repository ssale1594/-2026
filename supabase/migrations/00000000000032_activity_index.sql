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
