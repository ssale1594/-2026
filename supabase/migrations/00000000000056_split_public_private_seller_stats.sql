-- ============================================================
-- فصل إشارات الثقة العامة عن البيانات التجارية الخاصة
-- ============================================================
-- طُبّقت على القاعدة الحية في 2026-08-22 عبر Supabase MCP.
--
-- ما كان معطوبًا:
--   seller_completed_deals و get_seller_subscription و seller_offers_summary
--   و get_favorite_count كانت متاحة لدور anon وبلا حارس هوية. وأخطرها أن
--   صفحة البائع العامة كانت تطبع total_revenue_sar فعليًا لأي زائر —
--   إجمالي إيراد البائع معروضًا للمنافسين.
--
-- المبدأ: عدد الصفقات المكتملة إشارة ثقة مشروعة تُعرض للعامة. أما الإيراد
-- وعدد الخصومات والصفقات الجارية والاشتراك وحصص المفضلة فبيانات خاصة.

-- ---------- نسخ عامة: إشارات الثقة فقط ----------
create or replace function seller_public_deal_stats(p_seller_id uuid)
returns table (completed_count bigint, last30d_completed bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    (select count(*) from deals d
      where d.seller_id = p_seller_id and d.status in ('completed','buyer_confirmed'))::bigint,
    (select count(*) from deals d
      where d.seller_id = p_seller_id and d.status in ('completed','buyer_confirmed')
        and d.updated_at > now() - interval '30 days')::bigint;
$$;
grant execute on function seller_public_deal_stats(uuid) to anon, authenticated;

create or replace function seller_public_tier(p_seller_id uuid)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select tier::text from seller_subscriptions
   where seller_id = p_seller_id and status = 'active'
   limit 1;
$$;
grant execute on function seller_public_tier(uuid) to anon, authenticated;

-- ---------- النسخ الكاملة: حارس داخلي + حجب anon ----------
-- الحجب وحده لا يكفي: بدون الحارس أي مستخدم مسجّل يمرّر معرّف بائع آخر.

create or replace function seller_completed_deals(p_seller_id uuid)
returns table (completed_count bigint, total_revenue_sar numeric,
               in_progress_count bigint, disputed_count bigint, last30d_completed bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_own_seller(p_seller_id);
  return query
  select
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('completed','buyer_confirmed')), 0)::bigint,
    coalesce((select sum(d.price_agreed_sar) from deals d where d.seller_id = p_seller_id and d.status in ('completed','buyer_confirmed')), 0)::numeric,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('accepted','pending')), 0)::bigint,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status = 'disputed'), 0)::bigint,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('completed','buyer_confirmed') and d.updated_at > now() - interval '30 days'), 0)::bigint;
end $$;

create or replace function get_seller_subscription(p_seller_id uuid)
returns table (tier seller_tier, active_listing_limit integer, can_featured_ad boolean,
               featured_quota_monthly integer, premium_badge_level smallint,
               status text, days_left bigint, expires_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_own_seller(p_seller_id);
  return query
  select
    coalesce(s.tier, 'free')::seller_tier,
    coalesce(s.active_listing_limit, 10),
    coalesce(s.can_featured_ad, false),
    coalesce(s.featured_quota_monthly, 0),
    coalesce(s.premium_badge_level, 0)::smallint,
    coalesce(s.status, 'active'),
    (case when s.expires_at is null or s.status <> 'active' then null
          else extract(day from (s.expires_at - now()))::bigint end),
    s.expires_at
  from (select 1) g
  left join seller_subscriptions s on s.seller_id = p_seller_id
  limit 1;
end $$;

create or replace function seller_offers_summary(p_seller_id uuid)
returns table (pending_count bigint, countered_count bigint, today_received bigint,
               total_received bigint, accepted_count bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_own_seller(p_seller_id);
  return query
  select
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and status = 'pending'), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and status = 'countered'), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and created_at > now() - interval '1 day'), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id), 0)::bigint,
    coalesce((select count(*) from listing_offers where seller_id = p_seller_id and status in ('accepted','deal_created')), 0)::bigint;
end $$;

-- المفضلة تخص المستخدم نفسه لا البائع
create or replace function get_favorite_count(p_user_id uuid)
returns bigint
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or (p_user_id is distinct from auth.uid() and not is_admin()) then
    raise exception 'غير مصرح';
  end if;
  return (select count(*) from favorite_listings where user_id = p_user_id);
end $$;

revoke all on function seller_completed_deals(uuid) from public, anon;
revoke all on function get_seller_subscription(uuid) from public, anon;
revoke all on function seller_offers_summary(uuid) from public, anon;
revoke all on function get_favorite_count(uuid) from public, anon;

grant execute on function seller_completed_deals(uuid) to authenticated;
grant execute on function get_seller_subscription(uuid) to authenticated;
grant execute on function seller_offers_summary(uuid) to authenticated;
grant execute on function get_favorite_count(uuid) to authenticated;
