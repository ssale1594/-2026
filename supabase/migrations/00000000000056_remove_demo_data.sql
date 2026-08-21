-- ============================================================
-- حذف البيانات التجريبية — لا تطبّقها إلا بعد تسجيل أول بائع حقيقي
-- ============================================================
--
-- الهجرة 17 زرعت بائعَين تجريبيَّين وإعلانَين عشان الموقع ما يكون فاضيًا قبل
-- أول تسجيل حقيقي، وحذّرت بنفسها أن تُحذف بعدها. هذي هي عملية الحذف.
--
-- ⚠️ لا تشغّلها لين يصير عندك بائع حقيقي واحد على الأقل بإعلان منشور —
-- وإلا الموقع يصير فاضيًا تمامًا لكل زائر.
--
-- الحذف يبدأ من auth.users: كل شي تحته مرتبط بـon delete cascade
-- (auth.users -> profiles -> sellers -> listings -> listing_images ...)
-- فحذف المستخدم يشيل الشجرة كاملة بدون صفوف يتيمة.

do $$
declare
  v_real_sellers int;
begin
  -- حارس: عدّ البائعين المعتمدين غير التجريبيين اللي عندهم إعلان منشور
  select count(distinct s.id) into v_real_sellers
    from sellers s
    join listings l on l.seller_id = s.id and l.status = 'published'
   where s.slug not in ('demo-shop', 'demo-home-producer');

  if v_real_sellers = 0 then
    raise exception
      'موقوف: ما فيه بائع حقيقي واحد بإعلان منشور. حذف البيانات التجريبية الآن يخلّي الموقع فاضيًا. شغّلها بعدين.';
  end if;

  delete from auth.users
   where email in ('demo-shop@example.com', 'demo-home-producer@example.com');

  raise notice 'تم حذف البيانات التجريبية. البائعون الحقيقيون: %', v_real_sellers;
end $$;
