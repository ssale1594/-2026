-- ============================================================
-- إصلاح حجب الأعمدة — كان معطّلاً بالكامل عبر المشروع
-- ============================================================
--
-- المشروع يعتمد على نمط `revoke update (col) on t from authenticated`
-- في 14 موضعًا (الهجرات 15، 23، 24، 26، 27، 28، 29، 30، 31، 32) لتثبيت
-- أعمدة لا يجوز للمستخدم إعادة كتابتها — لأن WITH CHECK لا يقدر يثبّت
-- عمودًا على قيمته السابقة.
--
-- لكن هذا النمط لا يعمل. توثيق Postgres صريح:
--
--   "if a role has been granted privileges on a table, then revoking the
--    same privileges from individual columns will have no effect."
--
-- والهجرة 15 منحت `grant select, insert, update, delete on all tables`
-- على مستوى الجدول، وجعلتها الافتراضي لكل جدول لاحق. فكل revoke على
-- مستوى العمود بعدها أطلق تحذيرًا ومرّ بلا أثر:
--
--   البائع يقدر يرفع verification_status لنفسه إلى approved
--   البائع يقدر يرفع free_listing_limit و referral_bonus_slots لنفسه
--   البائع يقدر يعلّم إعلانه is_featured بدون دفع
--   أي مستخدم يقدر يزرع إشعارًا بعنوان ورابط من اختياره في صندوقه
--   صاحب السؤال يقدر ينشر سؤاله بنفسه متجاوزًا مراجعة الإدارة
--
-- الترتيب الصحيح: اسحب الصلاحية على مستوى الجدول أولاً، ثم امنحها على
-- الأعمدة المسموحة فقط. الكتلة أدناه تفعل ذلك اشتقاقًا من
-- information_schema، فلا تحتاج تعداد الأعمدة يدويًا ولا تنكسر لو أُضيف
-- عمود جديد لاحقًا — العمود الجديد يُمنح تلقائيًا ما لم يُدرج بالقائمة.

do $$
declare
  -- الجدول -> الأعمدة المحجوبة عن التعديل من authenticated
  protected jsonb := jsonb_build_object(
    'listings',      jsonb_build_array('id', 'seller_id', 'is_featured', 'created_at'),
    'sellers',       jsonb_build_array('id', 'verification_status', 'free_listing_limit',
                                       'identity_verified', 'referral_code',
                                       'referral_bonus_slots', 'last_active_at', 'created_at'),
    'transactions',  jsonb_build_array('id', 'buyer_id', 'seller_id', 'listing_id', 'created_at'),
    'offers',        jsonb_build_array('id', 'status', 'seller_id', 'created_at'),
    'questions',     jsonb_build_array('id', 'status', 'author_id', 'answer_count', 'created_at'),
    'answers',       jsonb_build_array('id', 'status', 'author_id', 'question_id', 'created_at'),
    'notifications', jsonb_build_array('id', 'user_id', 'type', 'title', 'body', 'link', 'created_at'),
    'events',        jsonb_build_array('id', 'status', 'created_by', 'created_at'),
    'jobs',          jsonb_build_array('id', 'seller_id', 'created_at'),
    'deals',         jsonb_build_array('id', 'listing_id', 'seller_id', 'buyer_id',
                                       'price_agreed_sar', 'created_at', 'accepted_at',
                                       'completed_at', 'disputed_at', 'rejected_at', 'cancelled_at'),
    'seller_bookings', jsonb_build_array('id', 'seller_id', 'buyer_id', 'listing_id', 'deal_id',
                                         'booking_date', 'start_minute', 'duration_minutes',
                                         'customer_name', 'customer_phone', 'service_title',
                                         'notes', 'created_at', 'confirmed_at',
                                         'completed_at', 'cancelled_at')
  );
  tbl text;
  cols text;
begin
  for tbl in select jsonb_object_keys(protected) loop
    -- الجدول قد لا يكون موجودًا لو طُبّقت الهجرات جزئيًا
    if to_regclass('public.' || quote_ident(tbl)) is null then
      continue;
    end if;

    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
      into cols
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = tbl
       and not (protected -> tbl ? c.column_name);

    -- اسحب على مستوى الجدول أولاً، وإلا ما نفع المنح على مستوى العمود
    execute format('revoke update on public.%I from authenticated', tbl);

    if cols is not null then
      execute format('grant update (%s) on public.%I to authenticated', cols, tbl);
    end if;
  end loop;
end $$;

-- تحقّق: هذا الاستعلام لازم يرجّع صفرًا بعد التطبيق. لو رجّع صفوفًا،
-- فأحد الأعمدة الحساسة ما زال قابلاً للتعديل.
--
--   select table_name, column_name
--     from information_schema.column_privileges
--    where grantee = 'authenticated' and privilege_type = 'UPDATE'
--      and (table_name, column_name) in (
--        ('sellers', 'verification_status'), ('sellers', 'free_listing_limit'),
--        ('sellers', 'referral_bonus_slots'), ('listings', 'is_featured'),
--        ('notifications', 'title'), ('notifications', 'link'),
--        ('questions', 'status'), ('deals', 'price_agreed_sar')
--      );
