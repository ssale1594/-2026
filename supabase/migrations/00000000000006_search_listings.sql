-- Arabic-aware listing search (TECH.md §3).
-- The query is normalized exactly like listings.search_text (أ/إ/آ → ا, ة → ه,
-- diacritics stripped) so "كيكه" and "كيكة" match the same rows, then pg_trgm
-- similarity handles typos and partial words.

create or replace function search_listings(
  p_query text,
  p_category_id int default null,
  p_limit int default 40
)
returns table (
  id uuid,
  title text,
  slug text,
  price numeric,
  price_negotiable boolean,
  business_name text,
  rank real
) as $$
  select
    l.id,
    l.title,
    l.slug,
    l.price,
    l.price_negotiable,
    s.business_name,
    similarity(l.search_text, normalize_arabic(p_query)) as rank
  from listings l
  join sellers s on s.id = l.seller_id
  where l.status = 'published'
    and (p_category_id is null or l.category_id = p_category_id)
    and (
      l.search_text % normalize_arabic(p_query)
      or l.search_text like '%' || normalize_arabic(p_query) || '%'
    )
  order by l.is_featured desc, rank desc, l.created_at desc
  limit least(p_limit, 100);
$$ language sql stable;
