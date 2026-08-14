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

## ✅ خلّصناها

### الصفحات العامة
- [x] `/` — الرئيسية: تصفح الفئات الخمس من `categories`
- [x] `/category/[slug]` — إعلانات الفئة المنشورة (المميزة أولًا ثم الأحدث)
- [x] `/listing/[slug]` — تفاصيل الإعلان + زر واتساب + تتبع النقرات والمشاهدات
- [x] `/seller/[slug]` — صفحة البائع المعتمد وإعلاناته
- [x] `/search?q=` — بحث عربي مطبَّع (يطابق كيكه/كيكة) عبر `pg_trgm`

### تحسين محركات البحث (SEO)
- [x] `sitemap.xml` ديناميكي (الفئات + البائعون المعتمدون + الإعلانات المنشورة)
- [x] `robots.txt` يستبعد `/dashboard /admin /api /auth /login /search`
- [x] `generateMetadata` لكل صفحة عامة — عنوان ووصف خاص بكل إعلان/بائع/فئة

### المصادقة والبائع
- [x] `/login` + `/auth/callback` — دخول برابط بريد (بدون كلمة مرور) عبر Supabase Auth
- [x] `/dashboard/setup` — إنشاء بيانات النشاط (يروح `pending`)
- [x] `/dashboard` — إعلانات البائع وحالتها وعدّاد الحد المجاني
- [x] `/dashboard/listings/new` — إضافة إعلان (يروح `pending_review`)
- [x] `/dashboard/listings/[id]/edit` — تعديل الإعلان (يرجّعه للمراجعة)
- [x] أرشفة إعلان (soft delete، بدل حذف فعلي)
- [x] رفع الصور: ضغط WebP بالعميل → Supabase Storage → حذف/ترتيب (حد 8 صور/إعلان)
- [x] حد يومي 3 إعلانات/بائع (PLAN §4.5) — مطبّق بـRLS، ما ينلف بالـAPI مباشرة

### لوحة الإدارة
- [x] `/admin/sellers` — اعتماد/رفض البائعين الجدد
- [x] `/admin/listings` — اعتماد/رفض الإعلانات
- [x] سجل `admin_actions` (audit log) لكل قرار إداري

### قاعدة البيانات (`supabase/migrations/`)
| # | الملف | المحتوى |
|---|---|---|
| 1 | `initial_schema` | كل الجداول + RLS + triggers + `can_create_listing` |
| 2 | `contact_click_rpc` | `record_contact_click` — تسجيل نقرة واتساب |
| 3 | `admin_actions` | سجل إجراءات الإدارة (TECH.md §12.3) |
| 4 | `profile_on_signup` | إنشاء `profiles` تلقائيًا عند التسجيل |
| 5 | `fix_admin_policy_recursion` | إصلاح تكرار لانهائي بسياسات الأدمن |
| 6 | `search_listings` | دالة البحث العربي المطبَّع |
| 7 | `view_count` | `record_listing_view` — تسجيل مشاهدة إعلان |
| 8 | `listing_images_storage` | bucket صور الإعلانات + RLS على `storage.objects` |
| 9 | `daily_listing_limit` | `can_create_listing_today` — حد 3 إعلانات جديدة باليوم |

### تنظيف
- [x] توحيد اسم الموقع بمصدر واحد (`lib/seo.ts`) بدل تكراره بـ13 مكان
- [x] حذف بيانات أحياء مخترعة (كانت اجتهاد شخصي غير موثوق)

## ⏳ باقي من المرحلة 1
- [ ] **الاشتراكات والدفع (Tap)** — الجداول جاهزة، ما فيه تكامل (يحتاج حساب Tap ومفاتيحه منك)
- [ ] **بيانات أحياء الزلفي الحقيقية** — الجدول فاضٍ، يحتاج قائمة موثوقة منك

## ملاحظات تقنية للجلسة الجاية
- ما فيه أنواع TypeScript مولّدة من Supabase (`database.types.ts`) — ينفع تولّدها بـ
  `npx supabase gen types typescript` عشان تختفي أخطاء الأنواع بالعلاقات المتداخلة
- `middleware.ts` طبقة راحة فقط مو حدود أمان — كل صفحة محمية تتحقق بنفسها عبر `lib/auth/permissions.ts`
- أول أدمن لازم يُرقّى يدويًا: `update profiles set role = 'admin' where id = '<user-id>';`
