-- ============================================================
-- تصليب صلاحيات الدوال + تثبيت search_path على دوال trigger فاتتها هجرة 15
-- ============================================================
--
-- طُبّقت هذي الهجرة مباشرة على قاعدة الإنتاج عبر أداة Supabase MCP بتاريخ
-- 2026-08-22 كجزء من مراجعة شاملة لكل القاعدة (وليس بس ما أضفناه الليلة).
-- هذا الملف يوثّقها محليًا بمشروع git فقط — لا تُعِد لصقها بمحرر SQL.
--
-- الاكتشاف: كل دالة SECURITY DEFINER بالمشروع (123 دالة) قابلة للاستدعاء
-- عبر PostgREST كـRPC من anon (بلا تسجيل دخول) بسبب سلوك Postgres الافتراضي
-- (CREATE FUNCTION يمنح EXECUTE لـPUBLIC تلقائيًا). لم تنكشف بأي مراجعة
-- سابقة لأن هجرة 15 عالجت GRANT على مستوى الجداول فقط، لا الدوال.
--
-- ملاحظة مهمة بعد التحقق الفعلي: Supabase نفسها تمنح EXECUTE لـanon/
-- authenticated بشكل مستقل عن PUBLIC (هذا جزء من آلية تعريض RPC بمنصتها) —
-- فسحب PUBLIC هذا تحصين إضافي (يطابق توصية الأمان الرسمية)، لكنه ليس
-- المصدر الوحيد لإمكانية الاستدعاء من anon. الحماية الفعلية تبقى الفحص
-- الداخلي (is_admin() أو auth.uid()) بكل دالة — وهذا مُتحقَّق ويعمل صح
-- (اختُبر حيًا: استدعاء admin_set_seller_verification بدون جلسة أدمن يُرفض
-- برسالة "غير مصرح به").

revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

alter function set_updated_at() set search_path = public, pg_temp;
alter function normalize_arabic(text) set search_path = public, pg_temp;
alter function set_listing_search_text() set search_path = public, pg_temp;
alter function update_seller_listing_count() set search_path = public, pg_temp;
alter function tier_weight(seller_tier) set search_path = public, pg_temp;
alter function seller_subs_set_updated() set search_path = public, pg_temp;
alter function listing_offers_set_timestamps() set search_path = public, pg_temp;
alter function deal_payments_set_ts() set search_path = public, pg_temp;
alter function deals_set_updated() set search_path = public, pg_temp;
alter function vouches_set_updated() set search_path = public, pg_temp;
