-- ============================================================
-- دوال حساب معايير شارات الإنجاز (Milestone Badges)
-- ============================================================

create or replace function seller_milestone_metrics(p_seller_id uuid)
returns table (
  total_listings_published bigint,
  avg_images_per_listing numeric,
  avg_first_reply_minutes_last10 numeric,
  read_rate_last10 numeric,
  vouch_count bigint,
  completed_deals bigint,
  completed_last30d bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_total bigint;
  v_images_sum bigint;
  v_avg_img numeric;
  v_vouch bigint;
  v_comp bigint;
  v_last30 bigint;
  v_reply_avg numeric;
  v_read_rate numeric;
begin
  -- Listings + avg images
  select count(*), coalesce(sum(image_count), 0)
    into v_total, v_images_sum
    from (
      select l.id,
        (select count(*) from listing_images li where li.listing_id = l.id) as image_count
      from listings l
      where l.seller_id = p_seller_id and l.status = 'published'
    ) q;
  if v_total is null then v_total := 0; end if;
  v_avg_img := case when v_total = 0 then 0 else round((v_images_sum::numeric / v_total::numeric) * 10) / 10 end;

  -- Vouch count
  select coalesce(count(*), 0) into v_vouch from vouches where seller_id = p_seller_id;

  -- Deals
  select coalesce(count(*), 0) into v_comp
    from deals
    where deals.seller_id = p_seller_id and status = 'completed';
  select coalesce(count(*), 0) into v_last30
    from deals
    where deals.seller_id = p_seller_id
      and status = 'completed'
      and completed_at > now() - interval '30 days';

  -- Chat metrics (average first reply minutes + read rate for last 10 threads with the seller as one side)
  select coalesce(avg(first_reply_minutes), 0)::numeric,
         coalesce(avg(read_rate), 0)::numeric
    into v_reply_avg, v_read_rate
    from (
      select
        t.id as thread_id,
        -- first reply from the OTHER party after the initiator's first message
        case
          when (
            select count(*) from chat_messages m where m.thread_id = t.id
          ) < 2 then null
          else extract(epoch from (
            (select m2.created_at from chat_messages m2 where m2.thread_id = t.id order by m2.created_at limit 1 offset 1)
            -
            (select m1.created_at from chat_messages m1 where m1.thread_id = t.id order by m1.created_at limit 1)
          )) / 60
        end as first_reply_minutes,
        -- fraction of unread counter that was read: since we denorm read_at per side, use a simpler heuristic
        case when t.buyer_id = p_seller_id then
          least(1, (select case when count(*) = 0 then 1 else (count(*) filter (where m.created_at <= coalesce(t.buyer_last_read_at, 'infinity'::timestamptz)))::numeric / count(*) end from chat_messages m where m.thread_id = t.id))
        else
          least(1, (select case when count(*) = 0 then 1 else (count(*) filter (where m.created_at <= coalesce(t.seller_last_read_at, 'infinity'::timestamptz)))::numeric / count(*) end from chat_messages m where m.thread_id = t.id))
        end as read_rate
      from chat_threads t
      where t.buyer_id = p_seller_id or t.seller_id = p_seller_id
      order by t.last_message_at desc nulls last
      limit 10
    ) q;

  return query select
    v_total, v_avg_img, coalesce(v_reply_avg, 0), coalesce(v_read_rate, 0), v_vouch, v_comp, v_last30;
end; $$;
grant execute on function seller_milestone_metrics(uuid) to anon, authenticated;
