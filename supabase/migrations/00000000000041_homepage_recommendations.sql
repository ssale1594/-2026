-- ============================================================
-- دوال التوصيات الذكية والساحة الرئيسية
-- ============================================================

-- 1) إعلانات ذات صلة بنفس الإعلان (نفس الفئة + نفس الحي أو نفس نطاق السعر)
create or replace function get_related_listings(
  p_listing_id uuid,
  p_limit int default 8
)
returns table (
  id uuid,
  title text,
  slug text,
  price numeric,
  neighborhood_name text,
  category_name text,
  view_count int,
  contact_click_count int,
  has_image boolean,
  match_score float4,
  status text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_category int;
  v_neighborhood int;
  v_price numeric;
begin
  select category_id, neighborhood_id, price
    into v_category, v_neighborhood, v_price
  from listings l where l.id = p_listing_id;

  return query
  select
    l.id,
    l.title,
    l.slug,
    l.price,
    n.name_ar as neighborhood_name,
    c.name_ar as category_name,
    l.view_count,
    l.contact_click_count,
    exists (select 1 from listing_images li where li.listing_id = l.id) as has_image,
    (
      (case when l.category_id = v_category then 0.55 else 0 end) +
      (case when l.neighborhood_id = v_neighborhood then 0.25 else 0 end) +
      (case
        when v_price is not null and l.price is not null
          and abs(l.price - v_price) / greatest(v_price, 1) <= 0.3
        then 0.2
        when v_price is null then 0.1
        else 0 end
      )
    )::float4 as match_score,
    l.status,
    l.created_at
  from listings l
  left join neighborhoods n on n.id = l.neighborhood_id
  left join categories c on c.id = l.category_id
  where l.status = 'published'
    and l.id <> p_listing_id
    and (l.category_id = v_category or l.neighborhood_id = v_neighborhood
         or (v_price is not null and l.price is not null
             and abs(l.price - v_price) / greatest(v_price, 1) <= 0.5))
  order by match_score desc, l.view_count desc, l.created_at desc
  limit p_limit;
end; $$;
grant execute on function get_related_listings(bigint,int) to anon, authenticated;

-- 2) أحدث الإعلانات المنشورة
create or replace function home_recent_listings(p_limit int default 12)
returns setof listings language sql stable security definer set search_path = public, pg_temp as $$
  select * from listings l
  where l.status = 'published'
  order by l.created_at desc
  limit p_limit;
$$;
grant execute on function home_recent_listings(int) to anon, authenticated;

-- 3) أكثر الإعلانات مشاهدة
create or replace function home_top_viewed(p_limit int default 8)
returns setof listings language sql stable security definer set search_path = public, pg_temp as $$
  select * from listings l
  where l.status = 'published' and l.created_at > now() - interval '60 days'
  order by l.view_count desc
  limit p_limit;
$$;
grant execute on function home_top_viewed(int) to anon, authenticated;

-- 4) أكثر الإعلانات اتصالات (معدل تحويل عالي = جودة)
create or replace function home_top_contacts(p_limit int default 8)
returns setof listings language sql stable security definer set search_path = public, pg_temp as $$
  select * from listings l
  where l.status = 'published'
    and l.created_at > now() - interval '60 days'
    and l.view_count >= 10
  order by (l.contact_click_count::float4 / nullif(l.view_count, 0)) desc nulls last,
           l.contact_click_count desc
  limit p_limit;
$$;
grant execute on function home_top_contacts(int) to anon, authenticated;

-- 5) الأحياء الأكثر نشاطاً + إحصائيات الساحة
create or replace function home_neighborhoods_activity(p_limit int default 10)
returns table (
  id int,
  name_ar text,
  slug text,
  listings_count bigint,
  sellers_count bigint,
  recent_views bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    n.id,
    n.name_ar,
    n.slug,
    (select count(*) from listings l where l.neighborhood_id = n.id and l.status = 'published')::bigint as listings_count,
    (select count(distinct l.seller_id) from listings l where l.neighborhood_id = n.id and l.status = 'published')::bigint as sellers_count,
    coalesce((select sum(l.view_count) from listings l where l.neighborhood_id = n.id and l.status = 'published' and l.created_at > now() - interval '30 days'), 0)::bigint as recent_views
  from neighborhoods n
  order by listings_count desc, recent_views desc
  limit p_limit;
end; $$;
grant execute on function home_neighborhoods_activity(int) to anon, authenticated;

-- 6) إحصائيات عامة للساحة الرئيسية
create or replace function home_overall_stats()
returns table (
  kpi text,
  val bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query select * from (values
    ('listings_total', (select count(*) from listings where status = 'published')::bigint),
    ('sellers_total', (select count(distinct seller_id) from listings where status = 'published')::bigint),
    ('listings_week', (select count(*) from listings where status = 'published' and created_at > now() - interval '7 days')::bigint),
    ('categories_total', (select count(*) from categories where parent_id is null)::bigint),
    ('neighborhoods_total', (select count(*) from neighborhoods)::bigint),
    ('contacts_week', (select coalesce(sum(contact_count_delta), 0)::bigint from interaction_log where interaction_type = 'contact' and created_at > now() - interval '7 days'))
  ) t(kpi, val);
end; $$;
grant execute on function home_overall_stats() to anon, authenticated;

-- 7) أكثر الفئات نشاطاً مع عدد الإعلانات
create or replace function home_top_categories(p_limit int default 12)
returns table (
  id int,
  name_ar text,
  slug text,
  parent_id int,
  icon_emoji text,
  listings_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    c.id,
    c.name_ar,
    c.slug,
    c.parent_id,
    c.icon_emoji,
    (select count(*) from listings l where l.category_id = c.id and l.status = 'published')::bigint as listings_count
  from categories c
  order by listings_count desc, c.name_ar asc
  limit p_limit;
end; $$;
grant execute on function home_top_categories(int) to anon, authenticated;
