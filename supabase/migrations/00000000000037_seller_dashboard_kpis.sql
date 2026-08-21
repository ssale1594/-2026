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
