-- ============================================================
-- دالة البحث المتقدمة مع الفلاتر والترتيب
-- تدعم: استعلام نصي، نطاق سعر، حي، فئة، حد أدنى للثقة، حد أدنى للتقييم، صور فقط، خيارات الترتيب
-- ============================================================

create or replace function search_listings_advanced(
  p_query text default '',
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_neighborhood_slug text default null,
  p_category_slug text default null,
  p_negotiable_only boolean default false,
  p_with_images_only boolean default false,
  p_min_trust_level int default 0,
  p_min_rating numeric default null,
  p_sort text default 'newest', -- newest | oldest | price_asc | price_desc | rating_desc | views_desc | contact_desc
  p_limit int default 60,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  slug text,
  price numeric,
  price_negotiable boolean,
  description text,
  has_images boolean,
  thumbnail_path text,
  view_count bigint,
  contact_click_count bigint,
  average_rating numeric,
  trust_level int,
  seller_id uuid,
  business_name text,
  seller_slug text,
  neighborhood_id int,
  neighborhood_slug text,
  neighborhood_name text,
  category_id int,
  category_slug text,
  category_name text,
  published_at timestamptz,
  rank_score float4
) as $$
begin
  return query
  with base as (
    select
      l.id,
      l.title,
      l.slug,
      l.price,
      l.price_negotiable,
      l.description,
      (exists (select 1 from listing_images li where li.listing_id = l.id)) as has_images,
      (select li.image_path from listing_images li where li.listing_id = l.id order by li.sort_order, li.id limit 1) as thumbnail_path,
      l.view_count,
      l.contact_click_count,
      l.seller_id,
      l.created_at as published_at,
      l.neighborhood_id,
      l.category_id,
      s.business_name,
      s.slug as seller_slug,
      n.name_ar as neighborhood_name,
      n.slug as neighborhood_slug,
      c.name_ar as category_name,
      c.slug as category_slug,
      coalesce(
        (select t.level from seller_trust(l.seller_id) t),
        0
      ) as trust_level,
      (select t.average_rating from seller_trust(l.seller_id) t) as average_rating,
      case
        when p_query <> '' then greatest(
          similarity(l.title, normalize_arabic(p_query)),
          similarity(l.description, normalize_arabic(p_query)) * 0.5,
          similarity(s.business_name, normalize_arabic(p_query)) * 0.3
        )
        else 0
      end::float4 as rank_score
    from listings l
    join sellers s on s.id = l.seller_id
    left join neighborhoods n on n.id = l.neighborhood_id
    left join categories c on c.id = l.category_id
    where l.status = 'published'
      and (p_negotiable_only = false or l.price_negotiable = true)
      and (p_price_min is null or l.price is null or l.price >= p_price_min)
      and (p_price_max is null or l.price is null or l.price <= p_price_max)
      and (p_neighborhood_slug is null or n.slug = p_neighborhood_slug)
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_with_images_only = false or exists (select 1 from listing_images li where li.listing_id = l.id))
      and (
        p_min_rating is null
        or exists (select 1 from seller_trust(l.seller_id) t where t.average_rating is not null and t.average_rating >= p_min_rating)
      )
      and (
        p_min_trust_level <= 0
        or exists (select 1 from seller_trust(l.seller_id) t where t.level >= p_min_trust_level)
      )
      and (
        p_query = ''
        or (
          normalize_arabic(l.title) % normalize_arabic(p_query)
          or normalize_arabic(l.description) % normalize_arabic(p_query)
          or normalize_arabic(s.business_name) % normalize_arabic(p_query)
          or to_tsvector('simple', coalesce(normalize_arabic(l.title), '')) @@ plainto_tsquery('simple', normalize_arabic(p_query))
        )
      )
  )
  select
    b.id, b.title, b.slug, b.price, b.price_negotiable, b.description,
    b.has_images, b.thumbnail_path, b.view_count, b.contact_click_count,
    b.average_rating, b.trust_level, b.seller_id, b.business_name, b.seller_slug,
    b.neighborhood_id, b.neighborhood_slug, b.neighborhood_name,
    b.category_id, b.category_slug, b.category_name, b.published_at,
    b.rank_score
  from base b
  order by
    case when p_sort = 'newest' then b.published_at end desc,
    case when p_sort = 'oldest' then b.published_at end asc,
    case when p_sort = 'price_asc' then b.price end asc nulls last,
    case when p_sort = 'price_desc' then b.price end desc nulls first,
    case when p_sort = 'rating_desc' then b.average_rating end desc nulls last,
    case when p_sort = 'views_desc' then b.view_count end desc,
    case when p_sort = 'contact_desc' then b.contact_click_count end desc,
    -- default fallback with text search
    case when p_query <> '' then b.rank_score end desc,
    b.published_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function search_listings_advanced(text,numeric,numeric,text,text,boolean,boolean,int,numeric,text,int,int) from anon, authenticated;
grant execute on function search_listings_advanced(text,numeric,numeric,text,text,boolean,boolean,int,numeric,text,int,int) to anon, authenticated, service_role;

-- ============================================================
-- دالة البحثات الشائعة (أكثر الكلمات بحثًا آخر 30 يومًا مع نتائج موجودة فقط)
-- ============================================================

create or replace function get_trending_searches(p_limit int default 10)
returns table (
  query text,
  count bigint,
  avg_results float4
) as $$
begin
  return query
  select
    normalized_query as query,
    count(*) as count,
    avg(results_count)::float4 as avg_results
  from search_log
  where created_at > now() - interval '30 days'
    and char_length(normalized_query) >= 2
  group by normalized_query
  having count(*) >= 2
  order by count desc, avg_results desc
  limit greatest(1, least(p_limit, 30));
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_trending_searches(int) from anon, authenticated;
grant execute on function get_trending_searches(int) to anon, authenticated, service_role;

-- ============================================================
-- دالة تصنيفات شائعة + أحياء شائعة (للفلاتر السريعة)
-- ============================================================

create or replace function get_popular_categories(p_limit int default 10)
returns table (
  id int, name_ar text, slug text, listing_count bigint
) as $$
begin
  return query
  select
    c.id, c.name_ar, c.slug,
    (select count(*) from listings l where l.category_id = c.id and l.status = 'published')::bigint as listing_count
  from categories c
  where c.is_active = true
  order by listing_count desc, c.name_ar
  limit greatest(1, least(p_limit, 30));
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_popular_categories(int) from anon, authenticated;
grant execute on function get_popular_categories(int) to anon, authenticated, service_role;
