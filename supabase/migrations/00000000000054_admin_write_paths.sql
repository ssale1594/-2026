-- ============================================================
-- إصلاح مسارات الكتابة الإدارية — كانت معطّلة بالكامل
-- ============================================================
--
-- الهجرة 53 سحبت UPDATE على مستوى الجدول ومنحته على أعمدة مختارة فقط، وهذا
-- صحيح ضد البائع. لكن صلاحيات الأعمدة بـPostgres مرتبطة بالـrole لا بالصف،
-- والأدمن بـSupabase هو نفس الـrole `authenticated`. سياسات RLS تحدد أي *صف*
-- يُلمس، لكنها لا تمنح صلاحية *عمود* أبدًا. النتيجة:
--
--   اعتماد بائع            -> 42501 permission denied for table sellers
--   نشر عرض / فعالية       -> نفس الخطأ (offers.status / events.status محجوبان)
--   اعتماد سؤال أو إجابة   -> نفس الخطأ
--
-- الحل: دوال SECURITY DEFINER تفحص is_admin() بنفسها وتُمنح لـauthenticated.
-- الحجب يبقى ساريًا ضد البائع العادي، والمسار الوحيد للتعديل هو هذي الدوال.
--
-- وأثناء ذلك تُصلَح ثلاثة أعطال أخرى بنفس الطبقة:
--   1. admin_actions.target_id من نوع uuid و target_type محصور بـ(seller,listing)
--      بينما الكود يمرر offer/event/job/referral بمعرّفات bigint -> كل سطر
--      بسجل التدقيق كان يفشل، حتى للإجراءات اللي تنجح.
--   2. عمود rejection_reason مستخدم بـmoderation-actions.ts وغير موجود بالسكيما.
--   3. content_reports.target_id من نوع bigint بينما listings.id من نوع uuid.

-- ============================================================
-- 1. أعمدة ناقصة يعتمد عليها الكود
-- ============================================================

alter table listings add column if not exists rejection_reason text;
alter table sellers  add column if not exists rejection_reason text;

-- الأعمدة الجديدة تُمنح تلقائيًا لـauthenticated بموجب الهجرة 15، ولا نريد
-- للبائع أن يكتب سبب رفض نفسه.
revoke update (rejection_reason) on listings from authenticated;
revoke update (rejection_reason) on sellers  from authenticated;

-- ============================================================
-- 2. سجل التدقيق — توسيع الأنواع وتحويل المعرّف إلى نص
-- ============================================================

alter table admin_actions drop constraint if exists admin_actions_target_type_check;
alter table admin_actions
  add constraint admin_actions_target_type_check
  check (target_type in ('seller', 'listing', 'offer', 'event', 'job',
                         'referral', 'question', 'answer', 'report', 'subscription'));

do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'admin_actions'
         and column_name = 'target_id') = 'uuid' then
    alter table admin_actions alter column target_id type text using target_id::text;
  end if;
end $$;

-- كتابة السجل تتم داخل الدوال أدناه (SECURITY DEFINER)، فلا حاجة لمنح
-- authenticated صلاحية الكتابة المباشرة عليه.
create or replace function log_admin_action(
  p_action text, p_target_type text, p_target_id text, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into admin_actions (admin_id, action, target_type, target_id, reason)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_reason);
end $$;

-- ============================================================
-- 3. دوال الأدمن — مسار الكتابة الوحيد للحقول المحجوبة
-- ============================================================

create or replace function admin_set_seller_verification(
  p_seller_id uuid, p_status text, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;

  update sellers
     set verification_status = p_status,
         rejection_reason = case when p_status = 'rejected' then p_reason else null end
   where id = p_seller_id;

  if not found then raise exception 'البائع غير موجود'; end if;
  perform log_admin_action('seller_' || p_status, 'seller', p_seller_id::text, p_reason);
end $$;

create or replace function admin_set_listing_status(
  p_listing_id uuid, p_status text, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('draft', 'pending_review', 'published', 'rejected',
                      'paused', 'expired', 'archived') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;

  update listings
     set status = p_status,
         published_at = case when p_status = 'published' then now() else published_at end,
         rejection_reason = case when p_status in ('rejected', 'archived') then p_reason else null end
   where id = p_listing_id;

  if not found then raise exception 'الإعلان غير موجود'; end if;
  perform log_admin_action('listing_' || p_status, 'listing', p_listing_id::text, p_reason);
end $$;

-- offers / events / jobs تتشارك نفس دورة المراجعة، لكن أعمدتها المحجوبة
-- تختلف، فتبقى دوال منفصلة بدل دالة واحدة تبني SQL ديناميكيًا (حقن SQL).
create or replace function admin_set_offer_status(p_offer_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('pending_review', 'published', 'rejected') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  update offers set status = p_status where id = p_offer_id;
  if not found then raise exception 'العرض غير موجود'; end if;
  perform log_admin_action('offer_' || p_status, 'offer', p_offer_id::text, null);
end $$;

create or replace function admin_set_event_status(p_event_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('pending_review', 'published', 'rejected') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  update events set status = p_status where id = p_event_id;
  if not found then raise exception 'الفعالية غير موجودة'; end if;
  perform log_admin_action('event_' || p_status, 'event', p_event_id::text, null);
end $$;

create or replace function admin_set_job_status(p_job_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('pending_review', 'published', 'closed', 'rejected') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  update jobs set status = p_status where id = p_job_id;
  if not found then raise exception 'الوظيفة غير موجودة'; end if;
  perform log_admin_action('job_' || p_status, 'job', p_job_id::text, null);
end $$;

create or replace function admin_set_referral_status(p_referral_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('pending', 'contacted', 'dismissed') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  update referrals set status = p_status where id = p_referral_id;
  if not found then raise exception 'الترشيح غير موجود'; end if;
  perform log_admin_action('referral_' || p_status, 'referral', p_referral_id::text, null);
end $$;

create or replace function admin_set_question_status(p_question_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('published', 'hidden') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  update questions set status = p_status where id = p_question_id;
  if not found then raise exception 'السؤال غير موجود'; end if;
  perform log_admin_action('question_' || p_status, 'question', p_question_id::text, null);
end $$;

create or replace function admin_set_answer_status(p_answer_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('published', 'hidden') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  update answers set status = p_status where id = p_answer_id;
  if not found then raise exception 'الإجابة غير موجودة'; end if;
  perform log_admin_action('answer_' || p_status, 'answer', p_answer_id::text, null);
end $$;

-- حظر بائع: كان الكود يحدّث `profiles` بأعمدة موجودة أصلاً بـ`sellers`
-- (verification_status / rejection_reason) فيفشل بخطأ "column does not exist".
create or replace function admin_ban_seller(p_seller_id uuid, p_reason text)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_archived integer;
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;

  update sellers
     set verification_status = 'suspended',
         rejection_reason = coalesce(p_reason, 'حظر من قبل الإدارة بناءً على تقارير المحتوى.')
   where id = p_seller_id;
  if not found then raise exception 'البائع غير موجود'; end if;

  with archived as (
    update listings
       set status = 'archived',
           rejection_reason = 'أرشفة تلقائية بسبب حظر الحساب.'
     where seller_id = p_seller_id and status = 'published'
    returning 1
  ) select count(*) into v_archived from archived;

  perform log_admin_action('seller_banned', 'seller', p_seller_id::text, p_reason);
  return v_archived;
end $$;

grant execute on function admin_set_seller_verification(uuid, text, text) to authenticated;
grant execute on function admin_set_listing_status(uuid, text, text)       to authenticated;
grant execute on function admin_set_offer_status(bigint, text)             to authenticated;
grant execute on function admin_set_event_status(bigint, text)             to authenticated;
grant execute on function admin_set_job_status(bigint, text)               to authenticated;
grant execute on function admin_set_referral_status(bigint, text)          to authenticated;
grant execute on function admin_set_question_status(bigint, text)          to authenticated;
grant execute on function admin_set_answer_status(bigint, text)            to authenticated;
grant execute on function admin_ban_seller(uuid, text)                     to authenticated;
revoke all on function log_admin_action(text, text, text, text) from anon, authenticated;

-- ============================================================
-- 4. لوحة التدقيق — كانت ميتة بالكامل
-- ============================================================

-- 4-أ. target_id لا يمكن أن يكون bigint: البلاغ الوحيد المستخدم فعليًا هو
-- الإبلاغ عن إعلان، ومعرّف الإعلان uuid. الكود كان يمرر Number(uuid) = NaN.
do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'content_reports'
         and column_name = 'target_id') = 'bigint' then
    alter table content_reports alter column target_id type text using target_id::text;
  end if;
end $$;

-- 4-ب. ما كان فيه سياسة SELECT للأدمن إطلاقًا — السياسة الوحيدة كانت
-- "المُبلِّغ يشوف بلاغه". التعليق بالهجرة 40 افترض أن الصفحة تستخدم
-- service_role، وهي ما تستخدمه.
drop policy if exists "admin reads all reports" on content_reports;
create policy "admin reads all reports"
  on content_reports for select using (is_admin());

drop policy if exists "admin updates reports" on content_reports;
create policy "admin updates reports"
  on content_reports for update using (is_admin()) with check (is_admin());

-- 4-ج. moderation_stats() كانت ممنوحة لـservice_role فقط بينما الصفحة
-- تناديها بعميل الجلسة. الدالة تفحص الدور بنفسها، فمنحها آمن.
grant execute on function moderation_stats() to authenticated;

-- ============================================================
-- 5. الاستفتاءات
-- ============================================================

-- 5-أ. poll_results() كانت تقرأ p.business_name و p.slug من `profiles`،
-- والعمودان موجودان بـ`sellers`. PL/pgSQL ما يتحقق من الأعمدة وقت الإنشاء،
-- فالخطأ ما يظهر إلا وقت التشغيل — أي أول استفتاء نشط يكسر /polls بـ500.
create or replace function poll_results(p_poll_id bigint)
returns table (
  option_id bigint,
  seller_id uuid,
  seller_name text,
  seller_slug text,
  votes_count bigint,
  percent_of_total float4
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_total bigint;
begin
  select count(*) into v_total from poll_votes where poll_id = p_poll_id;
  return query
  select
    o.id as option_id,
    o.seller_id,
    coalesce(s.business_name, s.slug, o.seller_id::text)::text as seller_name,
    s.slug as seller_slug,
    count(v.id)::bigint as votes_count,
    case when v_total > 0 then (count(v.id)::float4 / v_total::float4) * 100 else 0 end
  from poll_options o
  left join poll_votes v on v.option_id = o.id
  left join sellers s on s.id = o.seller_id
  where o.poll_id = p_poll_id
  group by o.id, o.seller_id, s.business_name, s.slug
  order by votes_count desc, o.sort_order asc, o.id asc;
end $$;

grant execute on function poll_results(bigint) to anon, authenticated;

-- 5-ب. /polls صفحة عامة، لكن السياسة كانت تشترط auth.role() = 'authenticated'
-- فالزائر غير المسجّل ما يشوف الاستفتاء أصلاً.
drop policy if exists "polls are visible to all authenticated" on polls;
create policy "polls are visible" on polls for select using (status <> 'draft' or is_admin());

drop policy if exists "poll options are visible" on poll_options;
create policy "poll options are visible" on poll_options for select using (true);

-- 5-ج. أزرار الأدمن كانت ممنوحة لـservice_role فقط. الدالتان تفحصان الدور.
grant execute on function admin_create_weekly_poll(text, text) to authenticated;
grant execute on function close_poll_and_set_winner(bigint)    to authenticated;

-- polls.status محجوب ضمنيًا: ما فيه grant update عليه لـauthenticated من
-- الهجرة 53 (الجدول مو بقائمتها)، فنسحب الجدول ونمنع التعديل المباشر —
-- التغيير الوحيد المسموح عبر الدالتين أعلاه.
revoke update on polls from authenticated;

-- ============================================================
-- 6. انتهاء الاشتراك — التزام TECH.md §5/§6 لم يُنفَّذ إطلاقًا
-- ============================================================
--
-- القرار الموثّق: "لا تحذف الإعلانات ولا تخفِ عشوائيًا — الإعلانات المجانية
-- (أول 8) تبقى نشطة، والزايدة عنها تصير paused مع رسالة للبائع."
-- تُستدعى من Vercel Cron يوميًا عبر /api/cron/expire-subscriptions.

create or replace function expire_due_subscriptions()
returns table (seller_id uuid, paused_count integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_limit int;
  v_paused int;
begin
  -- 1. علّم الاشتراكات المنتهية
  update subscriptions
     set status = 'expired'
   where status = 'active' and current_period_end is not null
     and current_period_end <= now();

  -- 2. لكل بائع بلا اشتراك فعّال وتجاوز حده المجاني: أوقف الأحدث أولاً،
  --    وأبقِ أقدم v_limit إعلانًا منشورًا (الأقدم = الأكثر رسوخًا بالبحث).
  for r in
    select s.id, s.free_listing_limit
      from sellers s
     where not exists (
       select 1 from subscriptions sub
        where sub.seller_id = s.id and sub.status = 'active'
          and sub.current_period_end > now()
     )
       and s.active_listings_count > s.free_listing_limit
  loop
    v_limit := r.free_listing_limit;

    with extra as (
      select id from listings
       where listings.seller_id = r.id and status = 'published'
       order by published_at desc nulls first, created_at desc
       offset v_limit
    )
    update listings l
       set status = 'paused',
           rejection_reason = 'موقوف مؤقتًا — انتهى الاشتراك. فعّله لإعادة النشر.'
      from extra
     where l.id = extra.id;

    get diagnostics v_paused = row_count;

    if v_paused > 0 then
      seller_id := r.id;
      paused_count := v_paused;
      return next;

      insert into notifications (user_id, type, title, body, link)
      values (r.id, 'subscription_expired',
              'انتهى اشتراكك',
              'لديك ' || v_paused || ' إعلان موقوف مؤقتًا. فعّل الاشتراك لإعادة نشرها.',
              '/dashboard/subscription');
    end if;
  end loop;
end $$;

revoke all on function expire_due_subscriptions() from anon, authenticated;
grant execute on function expire_due_subscriptions() to service_role;

-- ============================================================
-- 7. تحقّق بعد التطبيق (شغّلها يدويًا — لازم ترجع 0 صفوف)
-- ============================================================
--
--   select table_name, column_name
--     from information_schema.column_privileges
--    where grantee = 'authenticated' and privilege_type = 'UPDATE'
--      and (table_name, column_name) in (
--        ('sellers','verification_status'), ('sellers','rejection_reason'),
--        ('listings','is_featured'), ('listings','rejection_reason'),
--        ('offers','status'), ('events','status'), ('questions','status')
--      );
