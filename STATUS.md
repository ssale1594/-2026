# حالة التنفيذ — المرحلة 1

> يُحدَّث مع كل جلسة عمل. الترتيب المرجعي بـ[ROADMAP.md](ROADMAP.md)، القرارات التقنية بـ[TECH.md](TECH.md).

## ✅ تم التحقق فعليًا — الموقع يشتغل

بتاريخ 2026-08-14 اشتغل الموقع لأول مرة على جهاز فيه إنترنت بدون قيود، وانفحص فعليًا
(build كامل، `npm run dev`، وسكرين شات حقيقي عبر Playwright للرئيسية وصفحة فئة وتسجيل
الدخول، زائد اختبار بحث تفاعلي). **صفر أخطاء TypeScript، صفر أخطاء كونسول.**

## خطوات أول جلسة على أي جهاز جديد

1. `git pull origin main`
2. `npm install`
3. أنشئ `.env.local` من `.env.local.example` (القيم الحقيقية محفوظة بمحادثة سابقة معك — لا ترفعها لـGit أبدًا)
4. تأكد كل الـmigrations مطبّقة على مشروع Supabase (كلها انطبقت فعليًا — راجع الجدول تحت)
5. `npm run dev`

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

### قاعدة البيانات (`supabase/migrations/`) — كلها مطبّقة فعليًا على المشروع
| # | الملف | المحتوى |
|---|---|---|
| 1 | `initial_schema` | كل الجداول + RLS + triggers + `can_create_listing` |
| 2 | `contact_click_rpc` | `record_contact_click` — تسجيل نقرة واتساب |
| 3 | `admin_actions` | سجل إجراءات الإدارة (TECH.md §12.3) |
| 4 | `profile_on_signup` | إنشاء `profiles` تلقائيًا عند التسجيل |
| 5 | `fix_admin_policy_recursion` | إصلاح تكرار لانهائي بسياسات الأدمن |
| 6 | `search_listings` | دالة البحث العربي المطبَّع |
| 7 | `view_count` | `record_listing_view` — تسجيل مشاهدة إعلان |
| 9 | `listing_images_storage` | bucket صور الإعلانات + RLS على `storage.objects` |
| 10 | `daily_listing_limit` | `can_create_listing_today` — حد 3 إعلانات جديدة باليوم |
| 11 | `grant_base_privileges` | GRANT أساسي لـanon/authenticated (كان ناقص افتراضيًا بالمشروع) |
| 12 | `public_read_reference_tables` | RLS + سياسة قراءة عامة لـcategories/regions/neighborhoods/plans |

*(رقم 8 محذوف عمدًا — كان بيانات أحياء مخترعة، اتشال قبل التطبيق)*

### تنظيف
- [x] توحيد اسم الموقع بمصدر واحد (`lib/seo.ts`) بدل تكراره بـ13 مكان
- [x] حذف بيانات أحياء مخترعة (كانت اجتهاد شخصي غير موثوق)
- [x] إصلاح أنواع TypeScript للعلاقات المتداخلة بـSupabase (اكتُشفت بأول `tsc`/`build` فعلي)

## ⏳ باقي من المرحلة 1
- [ ] **الاشتراكات والدفع (Tap)** — الجداول جاهزة، ما فيه تكامل (يحتاج حساب Tap ومفاتيحه منك)
- [ ] **بيانات أحياء الزلفي الحقيقية** — الجدول فاضٍ، يحتاج قائمة موثوقة منك

## دروس مهمة من أول تشغيل فعلي (تفيد أي مشروع Supabase جديد)
1. **مشاريع Supabase الجديدة ما تمنح GRANT أساسي تلقائيًا** لـ`anon`/`authenticated` — لازم `grant all on all tables in schema public to anon, authenticated, service_role;` صراحة (migration 11).
2. **RLS يتفعّل تلقائيًا على كل جدول جديد** حتى لو ما استدعيت `enable row level security` بنفسك — أي جدول بدون policy صريحة يرجع نتائج فاضية بصمت (200 OK, بدون خطأ) لكل الأدوار ما عدا `service_role`. الجداول المرجعية العامة (categories, regions, neighborhoods, plans) احتاجت `for select using (true)` صريحة (migration 12).
3. **مفتاح `service_role` يتجاوز RLS دايمًا** — مفيد جدًا للتشخيص (لو شغّال بس anon فاضي، المشكلة صلاحيات/RLS مو بيانات).
4. **SQL Editor بـSupabase يشتغل autocommit لكل statement** (مو transaction واحدة) — لو سكربت طويل يفشل بمنتصفه، أول نص يتنفذ يبقى محفوظ. خلّينا كل migration لاحقة idempotent (`if not exists`, `on conflict do nothing`, `drop policy if exists`) عشان تتحمّل إعادة التشغيل بأمان.

## ملاحظات تقنية للجلسة الجاية
- ما فيه أنواع TypeScript مولّدة من Supabase (`database.types.ts`) — الأنواع اليدوية عبر `.returns<T>()`/`.single<T>()` شغّالة حاليًا، بس `npx supabase gen types typescript` أنضف حل طويل المدى
- `middleware.ts` طبقة راحة فقط مو حدود أمان — كل صفحة محمية تتحقق بنفسها عبر `lib/auth/permissions.ts`
- أول أدمن لازم يُرقّى يدويًا: `update profiles set role = 'admin' where id = '<user-id>';`
