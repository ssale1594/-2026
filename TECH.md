# القرارات والتوجيه التقني (v0.1)

> بخلاف PLAN.md (بنك أفكار العمل)، هذا الملف مخصص للقرارات والتوصيات **التقنية** لبناء الموقع، مبني على الأسئلة بـ[prompt-technical-questions.md](prompt-technical-questions.md).

---

## مبدأ التكلفة (محسوم — 2026-08-15) 💰

**لا ندفع فلوس على أي خدمة/أداة قبل ما يتأسس المشروع ويصير عنده دخل فعلي.** أي حاجة تقنية
(حد معدّل، بحث، تخزين، مراقبة، إلخ) تُحل أولًا بأدوات مجانية ضمن ما عندنا أصلًا (Postgres/Supabase
خطة مجانية، Vercel خطة مجانية) قبل التفكير بخدمة مدفوعة. لو ما فيه حل مجاني معقول، الميزة تُأجَّل
لين يثبت المشروع نفسه ماليًا — مو تُبنى بخدمة مدفوعة "على أمل" النجاح. مثال تطبيقي: حد يومي على
عدّادات المشاهدة/التواصل (STATUS.md) اتحل بجدول Postgres عادي بدل خدمة Redis/Rate-Limiting مدفوعة.

---

## القرار الحاسم: Supabase بدل Firebase ✅

**محسوم.** رغم الخبرة السابقة بـFirebase (من مشروع fas-warehouse-app)، بيانات هذا المشروع علائقية بطبيعتها (بائع → إعلان → فئة → اشتراك → دفعة) وتحتاج فلترة متعددة الشروط (فئة + سعر + حي). Postgres/Supabase أنسب تقنيًا، وSupabase يوفر SDK وتجربة قريبة من Firebase (Auth/Storage/DB جاهزين) فيقلل فرق التعلم.

---

## أفكار وتوصيات من Gemini (ردًا على البرومبت التقني)

### 1. نمذجة البيانات
- جداول: `profiles` (بائعين)، `categories` (فيها `parent_id` للفئات الفرعية)، `listings` (الجدول المركزي)، `subscriptions`.
- **حل مشكلة اختلاف الحقول حسب نوع الإعلان**: حقل `JSONB` باسم `metadata`/`details` بجدول `listings` للحقول الخاصة (غرف للعقار، ساعات عمل للخدمة)، والحقول المشتركة (سعر، عنوان، وصف، صور) أعمدة عادية. Postgres يفلتر ويبحث داخل JSONB بكفاءة.

### 2. البحث والفلترة
- **لا حاجة لـAlgolia/Meilisearch بهالمرحلة.** محرك Full-Text Search المدمج بـPostgres يكفي لعشرات آلاف الإعلانات. الفلترة (مدينة، سعر، قسم) عبر استعلامات Supabase العادية (`.eq()`, `.lte()`).

### 3. معالجة الصور
1. ضغط بجهة العميل قبل الرفع (مكتبة `browser-image-compression`، هدف أقل من 1MB).
2. الرفع مباشرة لـSupabase Storage عبر Signed URL (لا ترفعها عبر Vercel API لتفادي Timeouts).
3. العرض عبر `next/image` (تحويل تلقائي لـWebP وأحجام مناسبة).

### 4. المصادقة والصلاحيات
- **المشترون:** بدون تسجيل دخول إجباري — تصفح وتواصل واتساب حر بالكامل.
- **البائعون:** حساب عبر Supabase Auth، مع `@supabase/ssr` للتعامل مع الكوكيز بـNext.js 15 App Router.
- **الصلاحيات:** عبر **RLS (Row Level Security)** — Policy تسمح `SELECT` للجميع على الإعلانات النشطة، و`INSERT`/`UPDATE` فقط لصاحب الإعلان (`auth.uid() = seller_id`).

### 5. تطبيق قاعدة "5-10 مجاني ثم اشتراك"
1. عند الإضافة (Server Action): `COUNT(*)` لإعلانات البائع الحالية.
2. تحقق من جدول `subscriptions` — لو العدد > الحد المجاني وما فيه اشتراك فعّال، ارفض الطلب ووجّه لصفحة الدفع.
3. **انتهاء الاشتراك:** لا تحذف الإعلانات. Job دوري (Supabase pg_cron أو Vercel Cron) يغيّر حالة أحدث الإعلانات الزايدة عن الحد المجاني من `active` إلى `hidden`/`draft`.

### 6. بوابة الدفع
- **التوصية: Moyasar** — توثيق تقني ممتاز، مكتبات React جاهزة، يدعم مدى وApple Pay، قبول سريع للمشاريع الناشئة.
- **بالبداية:** اشتراك دفعة واحدة (شهر/سنة) + تذكير قبل الانتهاء بـ5 أيام، بدل التجديد التلقائي (أبسط قانونيًا وتقنيًا للمرحلة الأولى).
- تأكيد الدفع عبر Moyasar Webhooks → Next.js Route Handler (`/api/webhooks/moyasar`) مع التحقق من التوقيع قبل تحديث القاعدة.

### 7. تحسين محركات البحث (SEO)
- `generateMetadata` بالصفحات الديناميكية (فئة/إعلان) بعنوان يتضمن اسم المحافظة والقسم.
- **ISR** لصفحات الإعلان الفردية (`export const revalidate = 3600`).
- **Structured Data**: `<script type="application/ld+json">` بسكيمة `LocalBusiness` (خدمات) أو `Product` (سلع) لتحسين ظهور Google.
- `sitemap.ts` يولّد روابط الفئات والإعلانات ديناميكيًا.

### 8. تكامل واتساب
- روابط `wa.me` البسيطة (Click-to-chat) — **لا داعي لـWhatsApp Business API** (مكلف وغير ضروري بهالمرحلة).
- مثال: `https://wa.me/9665XXXXXXX?text={encodeURIComponent("مرحباً، شفت إعلانك بمنصة الزلفي بخصوص...")}`
- **تتبع النقرات**: الزر ينفّذ دالة تزيد `clicks_count` بقاعدة البيانات (عبر Supabase RPC) ثم تفتح `window.open(whatsappUrl, '_blank')` — يفيد لاحقًا بإثبات القيمة للبائع ("جبنا لك 50 عميل هالشهر").

### 9. الاستضافة والتكلفة
- Vercel Hobby (مجاني) للتطوير، لكن شروطه تمنع الاستخدام التجاري — **يلزم الترقية لـPro ($20/شهر) عند الإطلاق الفعلي وتفعيل الدفع.**
- Supabase Free يدخل بوضع Pause بعد أسبوع خمول وبدون نسخ احتياطي يومي — **Pro ($25/شهر) عند الإطلاق.**
- تقدير Gemini: ~45-50$/شهر عند الإطلاق. *(ملاحظة: ممكن تبدأ بالباقات المجانية لين يثبت الاستخدام الفعلي، وفيه حلول Cron بسيطة تمنع الـpause بمرحلة التطوير).*

### 10. هيكلة المشروع (Next.js App Router)
```
/app
  /(public)           # الواجهات العامة
    /page.tsx
    /category/[slug]
    /listing/[id]
  /(auth)
    /login
  /(seller)           # لوحة تحكم البائعين (محمية بـMiddleware)
    /dashboard/listings
    /dashboard/settings
  /(admin)            # لوحة الإدارة (محمية بصلاحية admin)
    /admin/approvals
/components           # مقسمة: common / seller / admin
/lib
  /supabase           # إعدادات الاتصال
  /actions            # Server Actions (منطق الأعمال هنا)
```
**أمان الإدارة:** لا يكفي إخفاء الروابط بالواجهة — لازم Server Actions وRLS يتحققون من `user.role === 'admin'` قبل أي عملية حساسة.

### 11. أخطاء شائعة يحذّر منها Gemini
1. **لا تبني نظام دردشة داخلي** — واتساب هو الملك بالسعودية، محاولة استبداله تضيّع وقتك كمؤسس منفرد.
2. **صور يتيمة (Orphaned Images)** — عند حذف إعلان، احذف صوره من Supabase Storage أول، وإلا تتراكم وتكلفك تخزين بلا فائدة.
3. **Vercel Timeouts** — العمليات الثقيلة (صور ضخمة، استعلامات غير مفهرسة) قد تسبب Timeout (حد أقصى 15-60 ثانية) — خلّي Server Actions سريعة ونفّذ المهام الثقيلة بجهة العميل أو بالقاعدة مباشرة.

---

---

## أفكار وتوصيات من ChatGPT (ردًا على نفس البرومبت التقني)

> رد أعمق وأكثر تفصيلًا تقنيًا من Gemini — يتفق معه على أغلب القرارات الكبرى (Supabase، لا Algolia بالبداية، لا WhatsApp Business API، buyer بدون حساب، RLS، ISR). الخلافات موثّقة بقسم "نقاط تحتاج حسم" بالأسفل.

### 1. Firebase vs Supabase
Supabase محسوم لنفس السبب: شكل البيانات علائقي (`seller → listings → categories → subscriptions → payments → events`)، وPostgres يعطي Foreign Keys وTransactions وIndexes وViews وTriggers وRLS حقيقية، بينما Firestore يتعقّد مع استعلامات مركبة (OR, in, array-contains-any محدودة) ويحتاج تكرار بيانات أو Cloud Functions للعمليات المركّبة (إنشاء إعلان + تحقق entitlement + عدّاد + ربط seller كلها بمعاملة واحدة atomic بـPostgres). **تحذير:** لا تستخدم Supabase مباشرة من المتصفح لكل شي — RLS للدفاع الأساسي، والعمليات الحساسة (business-critical mutations) على السيرفر فقط، وService Role Key لا يظهر للمتصفح إطلاقًا.

### 2. نمذجة البيانات — Schema فعلي مقترح
**النموذج: Core + Type-specific tables** (بدل عمود JSON واحد لكل شي، وبدل جدول listings بـ80 عمود فاضي).

- **`profiles`**: `id, auth_user_id, full_name, phone, email, role, created_at` — لا تعتمد على `role` هنا وحده للحماية، استخدم RLS/server-side authorization.
- **`sellers`**: `id, user_id, region_id, business_name, slug, description, phone, whatsapp, instagram_url, snapchat_url, logo_url, verification_status, status, created_at, updated_at`.
- **`regions`**: `id, name, slug, province_id, is_active` — **مهم من اليوم الأول** حتى لو فيه سجل وحيد ("الزلفي")، عشان التوسع لمحافظات ثانية لاحقًا بدون إعادة تصميم.
- **`categories`**: `id, region_id (nullable), parent_id (nullable), name_ar, name_en, slug, type, sort_order, is_active`.
- **`listings` (الجدول المركزي)**: `id, seller_id, region_id, category_id, listing_type, title, slug, description, price, price_type, status, neighborhood_id, latitude, longitude, is_featured, published_at, expires_at, created_at, updated_at`. `listing_type`: `product | service | real_estate | used_item`.
- **جداول تفصيل حسب النوع** (مرتبطة بـ`listing_id`): `product_listings` (brand, condition, sku)، `service_listings` (service_area, pricing_model, availability)، `real_estate_listings` (property_type, listing_purpose, bedrooms, bathrooms, area_sqm, furnished)، `used_item_listings` (condition, brand, model, year). **الفايدة:** صفحة المنتج ما تحمل حقول فاضية (bedrooms=null)، وإضافة نوع جديد لاحقًا (jobs, vehicles, events) ما يحتاج إعادة تصميم `listings` بالكامل.
- **`listing_images`**: `id, listing_id, storage_path, sort_order, width, height, alt_text, created_at`.
- **`neighborhoods`**: `id, region_id, name_ar, slug` — **لا تكتب اسم الحي كنص حر** بالإعلان (تفادي فوضى "السلام" / "حي السلام" / "السلّام" بالبحث).
- **`plans`**: `id, name, monthly_price, yearly_price, free_listing_limit, active`.
- **`subscriptions`**: `id, seller_id, plan_id, provider, provider_customer_id, provider_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at`.
- **`payments`**: `id, seller_id, subscription_id, provider, provider_payment_id, amount, currency, status, payment_type, paid_at, raw_reference, created_at` — لا تجعل بيانات الدفع نفسها مصدر الحقيقة الوحيد.
- **`payment_events`**: `id, provider, event_id, event_type, payload_hash, processed_at, created_at` — لتسجيل webhook events ومنع معالجة مكررة (idempotency).

### 3. البحث والفلترة
لا Algolia بالبداية (نفس رأي Gemini). استخدم: B-tree indexes للفلاتر، GIN للـfull-text، **`pg_trgm`** للمطابقة التقريبية (fuzzy) وتصحيح الأخطاء الإملائية، PostGIS لاحقًا لو احتجت بحث "قريب مني" بمسافة فعلية.
**تحدي البحث العربي تحديدًا:** المستخدم يكتب "كيكه/كيكة/كيكات/كيك" أو "كهربائي/كهربائيه/كهربائي منزل" — تحتاج طبقة تطبيع (normalization) قبل الـFTS: إزالة التشكيل، توحيد أ/إ/آ، معالجة حذرة لـة/ه، ثم `pg_trgm`. الانتقال لـMeilisearch/Typesense فقط لو احتجت typo tolerance قوي أو synonyms أو عشرات آلاف الإعلانات — مو الآن.

### 4. معالجة الصور
نفس تدفق Gemini (ضغط بجهة العميل → WebP → Supabase Storage → القاعدة تخزن المسار فقط)، بإضافات:
- حجم عملي: عرض أقصى 1600-2000px، جودة 75-85%، WebP — ما تحتاج أصلًا صورة 6000×4000 لإعلان.
- احفظ نسخة "محسّنة" + thumbnail منفصلة.
- **لا تخزن الصور Base64 بقاعدة البيانات إطلاقًا.**
- الصور الحساسة (هوية، وثائق توثيق) تروح **private bucket + signed URLs فقط**، مو public bucket زي صور الإعلانات العادية.

### 5. المصادقة والأدوار
- **Buyer بدون حساب إطلاقًا** — تصفح، بحث، عرض إعلان، ضغط واتساب/هاتف كلها من غير تسجيل دخول. "سجل حساب عشان تشوف رقم محل الكيك" يقتل الـconversion.
- **Seller** يحتاج حساب (signup → seller profile → verification → dashboard).
- الأدوار: `buyer, seller, moderator, admin, super_admin` — لكن **لا تستخدم `if (user.role === "admin")` بالفرونت إند كحماية وحيدة**، الحماية الحقيقية سيرفر-سايد + RLS.

### 6. تطبيق حد الإعلانات المجانية (Business-critical — سيرفر فقط)
لا تعتمد على فحص العدد بالفرونت إند إطلاقًا (أي أحد يتجاوزه). العملية الصحيحة **Server-side transaction** واحدة: تحميل البائع → تحميل الاشتراك الفعّال → تحديد العدد المسموح → عدّ الإعلانات النشطة/المنشورة الحالية → رفض أو إنشاء، كله بمعاملة atomic (يحمي من نافذتين مفتوحتين يضغط بيهم البائع "إنشاء" بنفس اللحظة).
**عند انتهاء الاشتراك:** لا تحذف ولا تخفي عشوائيًا — الإعلانات المجانية (أول 5-10) تبقى نشطة، والزايدة عنها تصير حالتها "متوقفة" (paused) مع رسالة للبائع "لديك 20 إعلان متوقف، فعّل الاشتراك لإعادة نشرها". **قرر من الآن:** العدّ يكون على الإعلانات "النشطة/المنشورة" فقط، مو drafts أو أرشيف.

### 7. بوابة الدفع — **Tap أولًا، Moyasar ثانيًا، HyperPay ثالثًا**
Tap يدعم recurring subscriptions على مدى فعليًا (بما فيها عبر Apple Pay tokenization) + STC Pay + بطاقات. Moyasar ممتاز أيضًا (recurring billing, saved tokens, webhooks) لكن بترتيب ثانٍ. **قبل التوقيع مع أي مزود:** اسأله كتابيًا هل recurring على مدى مدعوم فعليًا (direct أو عبر tokenization) وما قيود التجديد.
**البنية الصحيحة:** Frontend → Next.js Server → Payment Provider → **Webhook** → Next.js webhook endpoint → Database. الـWebhook هو مصدر الحقيقة، مو استجابة الفرونت إند مباشرة. **Idempotency إلزامي:** كل event له `event_id` فريد؛ لو وصل نفس الـevent مرتين، ارجع 200 بدون تكرار العملية (لا دفعة مكررة، لا تمديد اشتراك مرتين).

### 8. SEO — "قناة اكتساب أساسية مو مجرد Feature"
- أعلى أولوية فهرسة: `/listing/[slug]`, `/seller/[slug]`, `/category/[slug]`, `/category/[slug]/[subcategory]`, `/neighborhood/[slug]`.
- Structured data حسب النوع: `LocalBusiness` (أو نوع أدق) للبائع، `Product` للسلع (بدون تقييمات وهمية)، بيانات مخصصة للخدمة والعقار بدل إجبارها على نوع Product.
- `generateMetadata` ديناميكي لكل صفحة — **ممنوع** عناوين ثابتة عامة ("Al-Zulfi Marketplace") لكل الصفحات، لازم "مطعم X بالزلفي | دليل الزلفي" لكل صفحة على حدة.
- `sitemap.ts` ديناميكي لكل الإعلانات المنشورة والبائعين النشطين والفئات، `robots.ts` يستبعد `/dashboard /admin /api /account` ويمنع فهرسة صفحات بحث ديناميكية عديمة القيمة.
- استراتيجية Cache/ISR لكل نوع صفحة: Home/Category/Seller/Listing = Cached + revalidate، Search/Dashboard/Admin/Checkout/Webhooks = Dynamic بالكامل.

### 9. تكامل واتساب
نفس `wa.me` (لا Business API). **تتبع النقرات بدون ما يعطّل فتح واتساب:** أطلق analytics event أول، وبعدها `window.open()` مباشرة — لو الـanalytics فشل، واتساب لازم يفتح عادي بكل الأحوال. سجّل أحداث متعددة مو بس "ضغط واتساب": `listing_view, whatsapp_click, phone_click, save_listing, share_listing, directions_click` — هذي بيانات تصير منتج مدفوع بحد ذاتها لاحقًا (تقول للبائع: "428 مشاهدة، 31 ضغطة واتساب، 12 ضغطة اتصال").

### 10. الاستضافة والتكلفة
Vercel Hobby مجاني لكنه **موجّه للاستخدام الشخصي غير التجاري صراحة بشروط Vercel** — لازم Pro ($20/شهر) عند الإطلاق التجاري الفعلي. Supabase Free يكفي للتطوير (500MB DB, 1GB Storage, 5GB egress, 50K MAU)، وPro ($25/شهر) عند الإطلاق. **الأهم:** بحجم مشروعك (مئات بائعين، آلاف زوار شهريًا) أكبر احتمال ما يضربك هو Database CPU، بل **الصور والـegress** — راقبهم تحديدًا. لا داعي لـRedis/Algolia/S3/Workers منفصلة/Kubernetes من اليوم الأول.

### 11. هيكلة المشروع (نسخة أدق من Gemini)
```
src/
  app/
    (public)/    → page, search, categories, sellers, listings, neighborhoods
    (auth)/      → login, signup
    (seller)/    → dashboard, listings, subscription, analytics, profile
    (admin)/     → admin/sellers, listings, categories, subscriptions, reports
    api/         → webhooks/tap, webhooks/moyasar, analytics, uploads
  components/    → ui / public / seller / admin
  lib/
    supabase/    → client.ts, server.ts, middleware.ts
    db/          → queries/, mutations/
    auth/        → permissions.ts
    payments/    → tap/, moyasar/
    seo/  analytics/  validation/
  types/
```
**قاعدة صارمة:** لا منطق أعمال داخل `components/` ولا `page.tsx` — دايمًا UI → server action/route handler → business logic → database، بشكل مفصول.

### 12. عشر نقاط تقنية حرجة ما سألنا عنها (الأهم بالرد كامل)
1. **Lifecycle واضح لحالة الإعلان**: `draft, pending_review, published, rejected, paused, expired, archived` — مو حقل true/false بسيط.
2. **افصل `verified` عن `published`**: بائع موثّق ≠ إعلان مُراجَع. حقلين منفصلين: `seller_verification_status` و`listing_moderation_status`.
3. **Audit Log من أول يوم**: جدول `admin_actions` (admin_id, action, target_type, target_id, reason, created_at) — يبدو تافه لين يصير فيه نزاع (dispute)، وقتها يصير أهم جدول بالنظام.
4. **Slug مستقر منفصل عن الاسم**: الرابط يعتمد slug وصفي (`/مغسلة-السيارات-فلان`)، لكن الـID الداخلي (immutable) ما يتغير أبدًا حتى لو تغير الاسم.
5. **لا تثق بـ`sellerId` القادم من العميل**: تحديد البائع دائمًا من `currentUser` بالسيرفر (`currentUser → seller → listing`)، مو من قيمة يرسلها الفرونت إند — من أشهر ثغرات authorization.
6. **Validate كل شي سيرفر-سايد بـZod**: خصوصًا إنشاء الإعلان، السعر، الفئة، خطة الاشتراك، callbacks الدفع، بيانات الصور.
7. **Soft Delete بدل DELETE فعلي** للسجلات الحساسة (`deleted_at` أو status) — يفيد بالنزاعات والمراجعة والاسترجاع بالغلط.
8. **رقم الجوال مو هوية المستخدم** — `user.id` immutable هو الهوية، رقم الجوال مجرد attribute قابل للتغيير.
9. **لا تخزن بيانات حساسة غير ضرورية**: محتوى محادثات واتساب، دفتر هاتف، تفاصيل بطاقة دفع خام — خلّي tokenization عند مزود الدفع يتكفل ببيانات الدفع بالكامل.
10. **صمم Analytics Events من اليوم الأول**: `listing_view, search, category_view, whatsapp_click, phone_click, share, favorite, seller_profile_view, signup, listing_create, subscription_started, subscription_renewed, subscription_expired` — بعد 6 أشهر بتحتاج تعرف "أي فئة تجيب أكبر عدد اتصالات؟" ولو ما سجلتها من البداية ما تقدر ترجع بالزمن.

### جدول القرار النهائي المقترح من ChatGPT
| العنصر | الاختيار |
|---|---|
| Framework | Next.js 15 |
| UI | React 19 + Tailwind v4 |
| Backend | Supabase |
| DB | PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Search (بداية) | Postgres FTS + pg_trgm |
| Search (لاحقًا) | Typesense/Meilisearch |
| Images | ضغط بالعميل + WebP + Storage |
| Hosting | Vercel |
| Payments | Tap أولًا، Moyasar ثانيًا |
| حساب المشتري | غير مطلوب للتصفح |
| حساب البائع | مطلوب |
| Admin | Server-side + RLS |
| حد الإعلانات | معاملة DB/سيرفر atomic |
| مصدر حقيقة الاشتراك | Webhook + DB |
| واتساب | `wa.me` |
| Analytics | أحداث أول-طرف (first-party) |
| SEO | SSR/Cached + Metadata + JSON-LD + Sitemap |
| توسع لمحافظات ثانية | `region_id` من اليوم الأول |

---

---

## توافق شبه إجماعي من 5 مصادر (Gemini, ChatGPT, Grok, GLM, DeepSeek)

كل الخمسة اتفقوا بدون تنسيق على: **Supabase/Postgres** (مو Firebase)، **لا خدمة بحث خارجية بالبداية** (Postgres FTS/`pg_trgm` كافي)، **`wa.me` بسيط** (لا WhatsApp Business API)، **المشتري بدون حساب إجباري**، **RLS للحماية الحقيقية**، **ISR + JSON-LD + `generateMetadata` + `sitemap.ts`** للـSEO، **لا تحذف الإعلانات عند انتهاء الاشتراك بل أوقفها**، **الـWebhook هو مصدر الحقيقة للدفع لا الفرونت إند**. هذا شبه إجماع نادر بين 5 نماذج مستقلة — القرارات الأساسية بـTECH.md مؤكدة، مو رأي معزول.

## القرارات النهائية على النقطتين المعلّقتين

### 1. بنية حقول نوع الإعلان → **JSONB** (الأغلبية: Gemini, Grok, GLM, DeepSeek مقابل ChatGPT وحيد)
حقل `details`/`attributes` من نوع JSONB بجدول `listings` الموحّد، بدل جداول منفصلة لكل نوع. **حل DeepSeek الهجين هو الأذكى**: تبدأ بـJSONB لكل الحقول الخاصة (`{"bedrooms": 3, "area_sqm": 200}` للعقار مثلاً)، ولما تكتشف عمليًا إن المستخدمين يفلترون كثير حسب حقل معين (مثلاً عدد الغرف)، تستخرجه لعمود Generated Column مفهرس:
```sql
alter table listings add column bedrooms int
  generated always as ((details->>'bedrooms')::int) stored;
create index on listings (bedrooms);
```
يعطيك مرونة JSONB بالبداية + أداء عمود حقيقي بس على الحقول اللي فعلاً تحتاج فلترة سريعة لاحقًا — بدون إعادة تصميم الجدول.

### 2. بوابة الدفع → **Moyasar أولًا** (الأغلبية: Gemini, Grok, GLM, DeepSeek مقابل ChatGPT اللي رجّح Tap)
سبب الأغلبية: أبسط تقنيًا لمؤسس منفرد، SDK/Form جاهز بدون تعقيد شهادات PCI (بيانات البطاقة ما تمر عبر سيرفرك). **القرار العملي المشترك بين كل المصادر تقريبًا للتجديد:** التجديد التلقائي الحقيقي على مدى معقّد تنظيميًا بالسعودية (قيود ساما) — الأبسط بالمرحلة الأولى: **اشتراك يدوي لمرة واحدة + تذكير بالدفع قبل الانتهاء بـ3-5 أيام** (واتساب/إيميل)، بدل بناء auto-renewal من أول يوم. Tap يبقى بديل احتياطي جاهز لو Moyasar ما وفى بمتطلب معين.

---

## إضافات تقنية فريدة (من Grok / GLM / DeepSeek، ما ذكرها Gemini أو ChatGPT)

**من GLM:**
- **تتبع نقرة واتساب بشكل أدق**: بدل ما يفتح رابط `wa.me` مباشرة من الزر (صعب تتبعه بدقة لأنه يطلع المستخدم من الموقع فورًا)، خلي الزر يوجّه لمسار داخلي `/api/contact?seller=123&listing=456` يسجل النقرة بالقاعدة أول، وبعدين `redirect(302)` لرابط واتساب. تتبع أدق من "أطلق event ثم افتح الرابط" لأنه ما يعتمد على نجاح استدعاء JS بالمتصفح.
- **مشكلة N+1 Queries تحديدًا بـSupabase**: خطأ شائع جدًا تجلب الإعلان ثم البائع ثم الفئة بـ3 استعلامات منفصلة. استخدم الـEmbedding مباشرة: `supabase.from('listings').select('*, seller:profiles(*), category:categories(*)')` — استعلام واحد بدل ثلاثة، وإلا الموقع يصير بطيء فعليًا.
- **Migrations عبر Supabase CLI**: لا تعدّل الجداول يدويًا من لوحة Supabase وقت يكبر المشروع — سجّل كل تغيير Schema كملفات SQL بمجلد `supabase/migrations` وارفعها مع كود Next.js بنفس الـGit، يحميك من فقدان بنية البيانات.
- **Rate Limiting**: مكتبة `Upstash Ratelimit` (تتكامل بسلاسة مع Vercel+Supabase) لحماية البحث ولوحة البائع من الإغراق بالطلبات.

**من DeepSeek:**
- **حل عملي لتحدي البحث العربي** (اللي رفعه ChatGPT كتحدي بدون حل جاهز): Trigger يخزّن نسخة موحّدة من العنوان/الوصف بعمود إضافي `search_text` بعد توحيد الحروف (أ/إ/آ، ة/ه، ى/ي)، وفهرسة على هذا العمود بدل النص الخام — يحل مشكلة "كيكه/كيكة/كيكات" تلقائيًا بمستوى القاعدة.
- **رفض ملفات SVG برفع الصور**: خطر أمني حقيقي (SVG ممكن يحمل XSS) — قيّد الرفع لـJPG/PNG/WebP فقط.
- **معالجة الصور سيرفر-سايد بـ`sharp`**: بدل الاعتماد كليًا على ضغط جهة العميل، Route Handler بـNext.js يستقبل الصورة، يتحقق من النوع والحجم، يحوّلها WebP بعرض أقصى 1600px وجودة 80% بمكتبة `sharp` (سريعة على Vercel serverless)، ثم يرفعها. تحكم أدق من الاعتماد على ضغط المتصفح فقط.
- **Cloudflare R2 كبديل تخزين أرخص مستقبلًا**: بدون رسوم egress، خيار لو تخزين الصور صار مكلف على Supabase Storage لاحقًا.
- **عزل منطق البحث بدالة SQL واحدة** (`search_listings`) — يسمح تستبدلها لاحقًا بخدمة بحث خارجية (Meilisearch/Typesense) بدون تغيير الواجهة أو الكود اللي يستدعيها.

**من Grok:** لا إضافة جوهرية جديدة — رد متوافق تمامًا مع الإجماع، مفيد كتأكيد إضافي على القرار مو كمصدر أفكار جديدة.

**من Kimi (مصدر سادس، يؤكد الإجماع + إضافة حاسمة واحدة):**
- **⚠️ تفصيل يغيّر قرار بوابة الدفع عمليًا**: Moyasar وHyperPay **يتطلبان سجل تجاري سعودي (CR)** للتفعيل، بينما **Tap لا يشترطه** (يعمل بنموذج partner-merchant). يعني لو ما عندك سجل تجاري لسا، **Tap قد يكون الخيار الوحيد المتاح فعليًا بالبداية** بغض النظر عن التفضيل التقني البحت. هذا سؤال عملي/قانوني لازم يتحدد قبل ما نربط أي بوابة فعليًا — راجع القسم أدناه.
- تحذير أمني محدد: **CVE-2025-29927** (ثغرة تجاوز Middleware بـNext.js) — لا تعتمد على `middleware.ts` وحده كحاجز حماية، تحقق دائمًا أيضًا داخل Server Components وRoute Handlers مباشرة (طبقات دفاع متعددة، مو طبقة وحدة).
- عمود `active_listings_count` بجدول `sellers` يُحدَّث بـTrigger عند كل Insert/Delete/تغيير حالة، بدل عدّ `COUNT(*)` بكل مرة — أداء أفضل مع نفس الصرامة.
- كود Custom Image Loader جاهز لربط `next/image` بتحويلات صور Supabase مباشرة (resize/WebP تلقائي بدون خدمة خارجية).
- إمكانية `signInAnonymously()` بـSupabase Auth لو احتجت لاحقًا ميزة "مفضلة" للمشتري بدون حساب كامل.

### القرار النهائي على بوابة الدفع: **Tap أولًا فعليًا** (تصحيح على القرار السابق)
لا يوجد سجل تجاري (CR) حاليًا (صاحب المشروع موظف بشركة وما يقدر يطلع سجل باسمه حاليًا)، مع احتمال تسجيل CR مستقبلًا باسم أحد الإخوة لو احتجنا Moyasar لاحقًا. بما إن **Tap ما يشترط CR** (نموذج partner-merchant)، هو **الخيار العملي المتاح فعليًا للبدء**، بغض النظر عن كونه تفضيل تقني ثانوي عند أغلب المصادر. Moyasar يبقى خيار ترقية مستقبلي لو توفر سجل تجاري رسمي لاحقًا ورغبنا بمزايا إضافية.

---

## الخلاصة: التقنية محسومة، جاهزين للتنفيذ

بعد 5 مصادر مستقلة متفقة على نفس الأساسيات، ما فيه داعي لجمع رأي تقني سادس — الوقت الحين للانتقال من "جمع معلومات" إلى "تنفيذ فعلي": تثبيت Supabase، إنشاء الجداول المتفق عليها، وبناء أول شاشة (نموذج إضافة إعلان مع فرض حد 5-10 المجاني على مستوى السيرفر).

## ملاحظة
لو وصلتك ردود تقنية من مصادر ثانية مستقبلًا على نقطة معينة (مو عصف ذهني عام)، أضيفها هنا بقسم منفصل للمقارنة.
