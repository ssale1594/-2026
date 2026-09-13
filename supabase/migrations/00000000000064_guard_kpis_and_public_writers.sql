-- ============================================================
-- حارس هوية لمؤشرات البائع + تقييد كتّاب عموميين
-- ============================================================
-- طُبّقت على القاعدة الحية في 2026-08-22 عبر Supabase MCP.

-- ============================================================
-- 1) مؤشرات البائع
-- ============================================================
-- كانت ممنوحة لـservice_role فقط، فصفحة /dashboard/analytics ما تقدر
-- تناديها من جلسة البائع (والصفحة كانت تنادي اسمًا غير موجود أصلاً:
-- seller_dashboard_kpis بدل seller_overall_kpis).
--
-- الترتيب مقصود: الحارس داخل الدالة أولاً، ثم المنح. العكس يفتح البيانات
-- للحظة بلا حماية.

do $$
declare r record;
begin
  for r in
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
     where p.proname in ('seller_overall_kpis','seller_daily_stats','seller_performance_percentile')
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
  end loop;
end $$;

create or replace function seller_overall_kpis(p_seller_id uuid)
returns table (kpi text, value_7d bigint, value_30d bigint, value_total bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_own_seller(p_seller_id);
  return query
  with mine as (select l.id from listings l where l.seller_id = p_seller_id)
  select * from (values
    ('views',
      (select count(*) from interaction_log il join mine m on m.id = il.listing_id
        where il.kind='view' and il.day > current_date - 7)::bigint,
      (select count(*) from interaction_log il join mine m on m.id = il.listing_id
        where il.kind='view' and il.day > current_date - 30)::bigint,
      (select count(*) from interaction_log il join mine m on m.id = il.listing_id
        where il.kind='view')::bigint),
    ('whatsapp_clicks',
      (select count(*) from interaction_log il join mine m on m.id = il.listing_id
        where il.kind='contact' and il.day > current_date - 7)::bigint,
      (select count(*) from interaction_log il join mine m on m.id = il.listing_id
        where il.kind='contact' and il.day > current_date - 30)::bigint,
      (select count(*) from interaction_log il join mine m on m.id = il.listing_id
        where il.kind='contact')::bigint),
    ('offers_received',
      (select count(*) from listing_offers o where o.seller_id=p_seller_id and o.created_at > now() - interval '7 days')::bigint,
      (select count(*) from listing_offers o where o.seller_id=p_seller_id and o.created_at > now() - interval '30 days')::bigint,
      (select count(*) from listing_offers o where o.seller_id=p_seller_id)::bigint),
    ('deals_completed',
      (select count(*) from deals d where d.seller_id=p_seller_id and d.completed_at > now() - interval '7 days')::bigint,
      (select count(*) from deals d where d.seller_id=p_seller_id and d.completed_at > now() - interval '30 days')::bigint,
      (select count(*) from deals d where d.seller_id=p_seller_id and d.completed_at is not null)::bigint),
    ('revenue_sar',
      (select coalesce(sum(d.price_agreed_sar),0) from deals d where d.seller_id=p_seller_id and d.completed_at > now() - interval '7 days')::bigint,
      (select coalesce(sum(d.price_agreed_sar),0) from deals d where d.seller_id=p_seller_id and d.completed_at > now() - interval '30 days')::bigint,
      (select coalesce(sum(d.price_agreed_sar),0) from deals d where d.seller_id=p_seller_id and d.completed_at is not null)::bigint)
  ) t(kpi, value_7d, value_30d, value_total);
end $$;

revoke all on function seller_overall_kpis(uuid) from public, anon;
grant execute on function seller_overall_kpis(uuid) to authenticated;

-- ============================================================
-- 2) كتّاب عموميون بلا حارس
-- ============================================================
-- expire_stale_offers تُغيّر حالة صفوف؛ لا داعي لأن يشغّلها أي زائر.
revoke all on function expire_stale_offers() from public, anon, authenticated;
grant execute on function expire_stale_offers() to service_role;

-- link_referral_on_signup كانت تقبل أي معرّف بائع من أي منادٍ، فيقدر
-- زائر يعلّم ترشيحات "تمت المتابعة" بالجملة. تُستدعى عند إنشاء ملف
-- البائع، فيكفي أن تكون على البائع نفسه.
create or replace function link_referral_on_signup(p_seller_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_whatsapp text;
  v_matched_id bigint;
begin
  if auth.uid() is null or (p_seller_id is distinct from auth.uid() and not is_admin()) then
    raise exception 'غير مصرح';
  end if;

  select whatsapp_number into v_whatsapp from sellers where id = p_seller_id;
  if v_whatsapp is null then return; end if;

  select id into v_matched_id
    from referrals
   where status = 'pending'
     and business_whatsapp is not null
     and right(regexp_replace(business_whatsapp, '\D', '', 'g'), 9)
       = right(regexp_replace(v_whatsapp, '\D', '', 'g'), 9)
   limit 1;

  if v_matched_id is not null then
    update referrals
       set status = 'contacted',
           business_description = coalesce(business_description || e'\n\n', '')
             || '✅ انضم البائع بنفسه (تطابق تلقائي برقم واتساب) — ما يحتاج متابعة.'
     where id = v_matched_id;
  end if;
end $$;

revoke all on function link_referral_on_signup(uuid) from public, anon;
grant execute on function link_referral_on_signup(uuid) to authenticated;
