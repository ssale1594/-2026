-- ============================================================
-- Seller Analytics / KPIs per day (مخططات SVG)
-- ============================================================

create or replace function seller_analytics_daily(p_seller_id uuid, p_days int default 30)
returns table (
  bucket_day date,
  new_listings bigint,
  new_views bigint,
  whatsapp_clicks bigint,
  new_offers_received bigint,
  new_offers_sent bigint,
  new_chats bigint,
  chat_messages_received bigint,
  new_deals bigint,
  deals_completed bigint,
  revenue_sar numeric
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  start_date date;
begin
  start_date := (now() - format('%s days', greatest(1, least(p_days, 90)))::interval)::date;

  return query
  with days as (
    select generate_series(start_date, (now())::date, '1 day'::interval)::date as d
  )
  select
    days.d::date as bucket_day,
    coalesce((select count(*) from listings l
      where l.seller_id = p_seller_id and l.status = 'published' and l.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_views lv
      where lv.seller_id = p_seller_id and lv.viewed_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_whatsapp_clicks wc
      where wc.seller_id = p_seller_id and wc.clicked_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_offers lo
      where lo.seller_id = p_seller_id and lo.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from listing_offers lo
      where lo.offerer_id = p_seller_id and lo.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from chat_threads t
      where (t.buyer_id = p_seller_id or t.seller_id = p_seller_id) and t.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from chat_messages m
      join chat_threads t on m.thread_id = t.id
      where m.sender_id <> p_seller_id
        and (t.buyer_id = p_seller_id or t.seller_id = p_seller_id)
        and m.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from deals d
      where d.seller_id = p_seller_id and d.created_at::date = days.d), 0)::bigint,
    coalesce((select count(*) from deals d
      where d.seller_id = p_seller_id and d.completed_at::date = days.d), 0)::bigint,
    coalesce((select coalesce(sum(d.price_agreed_sar), 0) from deals d
      where d.seller_id = p_seller_id and d.status = 'completed' and d.completed_at::date = days.d), 0)::numeric;
  from days
  order by days.d asc;
end; $$;
grant execute on function seller_analytics_daily(uuid, int) to authenticated;

create or replace function seller_analytics_top_listings(p_seller_id uuid, p_limit int default 5)
returns table (
  listing_id uuid,
  title text,
  slug text,
  views_last30 bigint,
  whatsapp_clicks_last30 bigint,
  offers_last30 bigint,
  chat_threads_last30 bigint,
  neighbourhood text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with base as (
    select l.id as listing_id, l.title, l.slug,
      coalesce((select count(*) from listing_views v where v.listing_id = l.id and v.viewed_at > now() - interval '30 days'), 0)::bigint as v30,
      coalesce((select count(*) from listing_whatsapp_clicks w where w.listing_id = l.id and w.clicked_at > now() - interval '30 days'), 0)::bigint as w30,
      coalesce((select count(*) from listing_offers o where o.listing_id = l.id and o.created_at > now() - interval '30 days'), 0)::bigint as o30,
      coalesce((select count(*) from chat_threads t where t.listing_id = l.id and t.created_at > now() - interval '30 days'), 0)::bigint as c30,
      l.neighbourhood
    from listings l
    where l.seller_id = p_seller_id and l.status = 'published'
  )
  select listing_id, title, slug, v30, w30, o30, c30, coalesce(neighbourhood, '—')::text
  from base
  order by (v30 + w30 * 3 + o30 * 10 + c30 * 5) desc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
end; $$;
grant execute on function seller_analytics_top_listings(uuid, int) to authenticated;

create or replace function seller_analytics_top_neighbourhoods(p_seller_id uuid)
returns table (neighbourhood text, total bigint, pct numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with agg as (
    select coalesce(l.neighbourhood, 'غير محدد') as n, count(*) as c
    from listing_views lv
    join listings l on lv.listing_id = l.id
    where lv.seller_id = p_seller_id and lv.viewed_at > now() - interval '30 days'
      and l.seller_id = p_seller_id
    group by 1
    order by 2 desc
    limit 8
  )
  select n, c,
    round((c::numeric / nullif((select sum(c) from agg), 0) * 100.0), 1)
  from agg;
end; $$;
grant execute on function seller_analytics_top_neighbourhoods(uuid) to authenticated;

create or replace function seller_analytics_funnel(p_seller_id uuid)
returns table (
  step_name text,
  step_value bigint,
  conversion_rate_from_previous numeric
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_views bigint;
  v_whatsapp bigint;
  v_offers bigint;
  v_chats bigint;
  v_deals bigint;
  v_completed bigint;
begin
  v_views     := (select coalesce(count(*), 0) from listing_views where seller_id = p_seller_id and viewed_at > now() - interval '30 days');
  v_whatsapp  := (select coalesce(count(*), 0) from listing_whatsapp_clicks where seller_id = p_seller_id and clicked_at > now() - interval '30 days');
  v_offers    := (select coalesce(count(*), 0) from listing_offers lo where lo.seller_id = p_seller_id and lo.created_at > now() - interval '30 days');
  v_chats     := (select coalesce(count(*), 0) from chat_threads t where t.seller_id = p_seller_id and t.created_at > now() - interval '30 days');
  v_deals     := (select coalesce(count(*), 0) from deals d where d.seller_id = p_seller_id and d.created_at > now() - interval '30 days');
  v_completed := (select coalesce(count(*), 0) from deals d where d.seller_id = p_seller_id and d.completed_at > now() - interval '30 days');

  return query values
    ('👀 مشاهدات الإعلانات', v_views, 100.0),
    ('💬 محادثات جديدة', v_chats, round(100.0 * v_chats::numeric / nullif(v_views, 0), 2)),
    ('💸 عروض مالية وارده', v_offers, round(100.0 * v_offers::numeric / nullif(greatest(v_chats, 1), 0), 2)),
    ('🤝 صفقات جديدة', v_deals, round(100.0 * v_deals::numeric / nullif(greatest(v_offers, 1), 0), 2)),
    ('✅ صفقات مكتملة', v_completed, round(100.0 * v_completed::numeric / nullif(greatest(v_deals, 1), 0), 2));
end; $$;
grant execute on function seller_analytics_funnel(uuid) to authenticated;
