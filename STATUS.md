# حالة التنفيذ — المرحلة 1

> يُحدَّث مع كل جلسة عمل. الترتيب المرجعي بـ[ROADMAP.md](ROADMAP.md)، القرارات التقنية بـ[TECH.md](TECH.md).

## ⚠️ مهم: الكود مكتوب لكن **ما تم تشغيله ولا اختباره** بعد

كل اللي تحت انكتب على جهاز العمل، وفيه فايروول Fortinet يسوي SSL inspection يمنع `npm install`
(خطأ `UNABLE_TO_VERIFY_LEAF_SIGNATURE`) — يعني ما قدرنا نشغّل `npm run dev` ولا مرة.
**توقع أخطاء ترجمة (TypeScript) وأخطاء تشغيل** بأول مرة تشتغل عليه بالجهاز الشخصي.

## خطوات أول جلسة على الجهاز الشخصي

1. `git pull origin main`
2. `npm install`
3. انسخ `.env.local.example` إلى `.env.local` واملأ مفاتيح Supabase (URL + anon key + service role)
4. طبّق المايجريشنات وseed على مشروع Supabase (`supabase db push` أو من الداشبورد)
5. `npm run dev` وصلّح الأخطاء اللي تطلع

## المبني حتى الآن

### الصفحات العامة
- `/` — الرئيسية: تصفح الفئات الخمس من `categories`
- `/category/[slug]` — إعلانات الفئة المنشورة (المميزة أولًا ثم الأحدث)
- `/listing/[slug]` — تفاصيل الإعلان + زر واتساب + تتبع النقرات
- `/seller/[slug]` — صفحة البائع المعتمد وإعلاناته

### المصادقة والبائع
- `/login` + `/auth/callback` — دخول برابط بريد (بدون كلمة مرور) عبر Supabase Auth
- `/dashboard/setup` — إنشاء بيانات النشاط (يروح `pending`)
- `/dashboard` — إعلانات البائع وحالتها وعدّاد الحد المجاني
- `/dashboard/listings/new` — إضافة إعلان (يروح `pending_review`)

### لوحة الإدارة
- `/admin/sellers` — اعتماد/رفض البائعين الجدد
- `/admin/listings` — اعتماد/رفض الإعلانات

### قاعدة البيانات (`supabase/migrations/`)
| # | الملف | المحتوى |
|---|---|---|
| 1 | `initial_schema` | كل الجداول + RLS + triggers + `can_create_listing` |
| 2 | `contact_click_rpc` | `record_contact_click` — تسجيل نقرة واتساب |
| 3 | `admin_actions` | سجل إجراءات الإدارة (TECH.md §12.3) |
| 4 | `profile_on_signup` | إنشاء `profiles` تلقائيًا عند التسجيل |
| 5 | `fix_admin_policy_recursion` | إصلاح تكرار لانهائي بسياسات الأدمن |

## ناقص من المرحلة 1
- **رفع الصور** — `listing_images` موجود بالسكيما لكن ما فيه رفع فعلي لـSupabase Storage، وصفحة الإعلان تعرض مربعات فاضية بدل الصور
- **البحث** — `search_text` + `pg_trgm` جاهزين بالسكيما، ما فيه واجهة بحث بعد
- **تعديل/حذف إعلان** من لوحة البائع
- **حد يومي لإضافة المنتجات** (PLAN §4.5) — الحد الإجمالي مطبّق، اليومي لا
- **الاشتراكات والدفع (Tap)** — الجداول جاهزة، ما فيه تكامل

## ملاحظات تقنية للجلسة الجاية
- ما فيه أنواع TypeScript مولّدة من Supabase (`database.types.ts`) — ينفع تولّدها بـ
  `npx supabase gen types typescript` عشان تختفي أخطاء الأنواع بالعلاقات المتداخلة
- `middleware.ts` طبقة راحة فقط مو حدود أمان — كل صفحة محمية تتحقق بنفسها عبر `lib/auth/permissions.ts`
- أول أدمن لازم يُرقّى يدويًا: `update profiles set role = 'admin' where id = '<user-id>';`
