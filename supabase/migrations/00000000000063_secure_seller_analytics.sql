-- ============================================================
-- إصلاح ثغرة تحليلات البائع + إعادة بنائها على جداول موجودة فعلاً
-- ============================================================
-- طُبّقت على القاعدة الحية في 2026-08-22 عبر Supabase MCP، ومحفوظة هنا
-- ليبقى المستودع مطابقًا للواقع.
--
-- ما كان معطوبًا:
--   1. دوال seller_analytics_* كانت SECURITY DEFINER تأخذ معرّف البائع
--      كوسيط وهي متاحة لدور anon. ومعرّفات البائعين ليست سرية، فأي زائر
--      غير مسجّل كان يقدر يقرأ مشاهدات أي بائع وعروضه وصفقاته وإيراداته.
--   2. كانت تقرأ من listing_views و listing_whatsapp_clicks — جدولان لا
--      وجود لهما في القاعدة، فكانت تفشل وقت التشغيل أصلاً. البديل الحقيقي
--      هو interaction_log (الهجرة 16) و seller_contact_clicks.

-- حارس مشترك: البائع نفسه فقط، أو الإدارة.
create or replace function assert_own_seller(p_seller_id uuid)
returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    raise exception 'يلزم تسجيل الدخول';
  end if;
  if p_seller_id is distinct from auth.uid() and not is_admin() then
    raise exception 'غير مصرح: هذه البيانات خاصة بالبائع نفسه';
  end if;
end $$;
revoke all on function assert_own_seller(uuid) from public, anon;
grant execute on function assert_own_seller(uuid) to authenticated;

-- ============================================================
-- 1) الأداء اليومي
-- ============================================================
-- ملاحظة: interaction_log يسجّل صفًا واحدًا لكل (إعلان، نوع، زائر، يوم)
-- بسبب قيد الهجرة 16، فالعدد هنا "زوار متفردون في اليوم" لا نقرات خام.
create or replace function seller_analytics_daily(p_seller_id uuid, p_days int default 30)
returns table (
  bucket_day date, new_listings bigint, new_views bigint, whatsapp_clicks bigint,
  new_offers_received bigint, new_offers_sent bigint, new_chats bigint,
  chat_messages_received bigint, new_deals bigint, deals_completed bigint, revenue_sar numeric
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_own_seller(p_seller_id);
  return query
  with span as (
    select generate_series(
      current_date - (greatest(1, least(coalesce(p_days,30), 365)) - 1),
      current_date, interval '1 day')::date as d
  ),
  mine as (select l.id from listings l where l.seller_id = p_seller_id)
  select
    s.d,
    (select count(*) from listings l where l.seller_id = p_seller_id and l.created_at::date = s.d)::bigint,
    (select count(*) from interaction_log il join mine m on m.id = il.listing_id
      where il.kind = 'view' and il.day = s.d)::bigint,
    ((select count(*) from interaction_log il join mine m on m.id = il.listing_id
       where il.kind = 'contact' and il.day = s.d)
     + (select count(*) from seller_contact_clicks sc
         where sc.seller_id = p_seller_id and sc.clicked_at::date = s.d))::bigint,
    (select count(*) from listing_offers o where o.seller_id = p_seller_id and o.created_at::date = s.d)::bigint,
    (select count(*) from listing_offers o where o.offerer_id = p_seller_id and o.created_at::date = s.d)::bigint,
    (select count(*) from chat_threads t where t.seller_id = p_seller_id and t.created_at::date = s.d)::bigint,
    (select count(*) from chat_messages cm join chat_threads t on t.id = cm.thread_id
      where t.seller_id = p_seller_id and cm.sender_id <> p_seller_id and cm.created_at::date = s.d)::bigint,
    (select count(*) from deals dl where dl.seller_id = p_seller_id and dl.created_at::date = s.d)::bigint,
    (select count(*) from deals dl where dl.seller_id = p_seller_id and dl.completed_at::date = s.d)::bigint,
    (select coalesce(sum(dl.price_agreed_sar), 0) from deals dl
      where dl.seller_id = p_seller_id and dl.completed_at::date = s.d)::numeric
  from span s order by s.d;
end $$;

-- ============================================================
-- 2) مسار التحويل
-- ============================================================
create or replace function seller_analytics_funnel(p_seller_id uuid)
returns table (step_name text, step_value bigint, conversion_rate_from_previous numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_views bigint; v_chats bigint; v_offers bigint; v_deals bigint; v_completed bigint;
begin
  perform assert_own_seller(p_seller_id);

  v_views := (select count(*) from interaction_log il
                join listings l on l.id = il.listing_id
               where l.seller_id = p_seller_id and il.kind = 'view'
                 and il.day > current_date - 30);
  v_chats := (select count(*) from chat_threads t
               where t.seller_id = p_seller_id and t.created_at > now() - interval '30 days');
  v_offers := (select count(*) from listing_offers o
                where o.seller_id = p_seller_id and o.created_at > now() - interval '30 days');
  v_deals := (select count(*) from deals d
               where d.seller_id = p_seller_id and d.created_at > now() - interval '30 days');
  v_completed := (select count(*) from deals d
                   where d.seller_id = p_seller_id and d.completed_at > now() - interval '30 days');

  return query values
    ('👀 مشاهدات الإعلانات', v_views, 100.0::numeric),
    ('💬 محادثات جديدة', v_chats, round(100.0 * v_chats::numeric / nullif(v_views, 0), 2)),
    ('💸 عروض مالية واردة', v_offers, round(100.0 * v_offers::numeric / nullif(v_chats, 0), 2)),
    ('🤝 صفقات جديدة', v_deals, round(100.0 * v_deals::numeric / nullif(v_offers, 0), 2)),
    ('✅ صفقات مكتملة', v_completed, round(100.0 * v_completed::numeric / nullif(v_deals, 0), 2));
end $$;

-- ============================================================
-- 3) أفضل الإعلانات
-- ============================================================
create or replace function seller_analytics_top_listings(p_seller_id uuid, p_limit int default 5)
returns table (
  listing_id uuid, title text, slug text, views_last30 bigint,
  whatsapp_clicks_last30 bigint, offers_last30 bigint,
  chat_threads_last30 bigint, neighbourhood text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_own_seller(p_seller_id);
  return query
  select
    l.id, l.title, l.slug,
    (select count(*) from interaction_log il
      where il.listing_id = l.id and il.kind = 'view' and il.day > current_date - 30)::bigint,
    (select count(*) from interaction_log il
      where il.listing_id = l.id and il.kind = 'contact' and il.day > current_date - 30)::bigint,
    (select count(*) from listing_offers o
      where o.listing_id = l.id and o.created_at > now() - interval '30 days')::bigint,
    (select count(*) from chat_threads t
      where t.listing_id = l.id and t.created_at > now() - interval '30 days')::bigint,
    coalesce(n.name_ar, '—')
  from listings l
  left join neighborhoods n on n.id = l.neighborhood_id
  where l.seller_id = p_seller_id
  order by 4 desc, 5 desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 50));
end $$;

-- ============================================================
-- 4) توزيع المشاهدات على الأحياء
-- ============================================================
create or replace function seller_analytics_top_neighbourhoods(p_seller_id uuid)
returns table (neighbourhood text, total bigint, pct numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_total bigint;
begin
  perform assert_own_seller(p_seller_id);

  select count(*) into v_total
    from interaction_log il join listings l on l.id = il.listing_id
   where l.seller_id = p_seller_id and il.kind = 'view' and il.day > current_date - 30;

  return query
  select coalesce(n.name_ar, '—'),
         count(*)::bigint,
         round(100.0 * count(*)::numeric / nullif(v_total, 0), 1)
    from interaction_log il
    join listings l on l.id = il.listing_id
    left join neighborhoods n on n.id = l.neighborhood_id
   where l.seller_id = p_seller_id and il.kind = 'view' and il.day > current_date - 30
   group by n.name_ar
   order by 2 desc
   limit 10;
end $$;

-- ============================================================
-- الصلاحيات: البائع المسجّل فقط. anon محجوب صراحة.
-- ============================================================
revoke all on function seller_analytics_daily(uuid, int) from public, anon;
revoke all on function seller_analytics_funnel(uuid) from public, anon;
revoke all on function seller_analytics_top_listings(uuid, int) from public, anon;
revoke all on function seller_analytics_top_neighbourhoods(uuid) from public, anon;

grant execute on function seller_analytics_daily(uuid, int) to authenticated;
grant execute on function seller_analytics_funnel(uuid) to authenticated;
grant execute on function seller_analytics_top_listings(uuid, int) to authenticated;
grant execute on function seller_analytics_top_neighbourhoods(uuid) to authenticated;
