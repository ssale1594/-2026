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
