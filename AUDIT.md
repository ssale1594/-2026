# تقرير مراجعة شاملة — سوق الزلفي (2026-08-21)

> مراجعة للكود الفعلي (`app/`, `components/`, `lib/`, `supabase/migrations/`, `middleware.ts`)
> مقابل [TECH.md](TECH.md) و[ROADMAP.md](ROADMAP.md). كل نقطة "حرجة" أدناه تم التحقق منها إما
> بقراءة الكود مع دلالة Postgres الموثّقة، أو باختبار فعلي على قاعدة الإنتاج.

---

## الملخص التنفيذي

**لا، المشروع غير جاهز للإطلاق** — رغم أن ~95% من الواجهات مبنية وتفتح بدون خطأ.
السبب أن الأعطال ليست بالواجهة بل بطبقة الصلاحيات، ولا تظهر إلا عند أول **كتابة** حقيقية.

أهم ٣ أشياء توقف الإطلاق:
1. **الأدمن ما يقدر يعتمد أي بائع.** حجب الأعمدة بالهجرة 53 يشمل الأدمن نفسه (هو `authenticated` مثل الجميع) — و"المراجعة اليدوية لكل بائع" هي عمود المرحلة 1. مُثبت حيًا: `42501 permission denied`.
2. **لا توجد أي مهمة مجدولة (cron).** انتهاء الاشتراك ما يوقف الإعلانات الزايدة (قرار TECH.md §6)، وعامل الإيميل `/api/email-worker` ما ينضرب أبدًا → كل الإشعارات البريدية معطّلة.
3. **مسار الدفع مقطوع** — Tap بدون مفاتيح، فالبائع اللي يتجاوز 8 إعلانات يوصل لطريق مسدود بدل صفحة دفع.

وملاحظة بنيوية: ~70% من الكود المبني ينتمي للمراحل 2-4 لا للمرحلة 1، وكله "يشتغل" حاليًا فقط لأن جداوله فاضية.

---

## 1. فجوة التنفيذ

### ✅ مكتمل فعليًا من المرحلة 1

| البند | الحالة | الدليل |
|---|---|---|
| 5 فئات أساسية | ✅ مزروعة وفعّالة | `categories` = shops, home-producers, services, real-estate, used-items |
| زر واتساب مباشر | ✅ | `app/listing/[slug]/whatsapp-button.tsx` + تتبع نقرة عبر `/api/contact-click` |
| حد يومي (منع سبام) | ✅ **مطبّق بالباك إند فعلاً** | `can_create_listing_today()` داخل سياسة `listings_insert_own` نفسها — مو بالواجهة |
| حد الفريميوم (8 مجانًا) | ✅ نصف | `can_create_listing()` بالـRLS + عدّاد `active_listings_count` بـtrigger |
| الشاشات الخمس | ✅ | رئيسية+بحث، `category/[slug]`، `seller/[slug]`، `dashboard`، `admin` |
| البحث العربي | ✅ | `normalize_arabic()` + `pg_trgm` + `search_listings_advanced()` |
| RLS أساسي | ✅ | كل الجداول عليها RLS مفعّل |
| SEO | ✅ | `generateMetadata`, `sitemap.xml`, `robots.txt`, JSON-LD |
| 26 حي بالزلفي | ✅ | migration 14 |

### ❌ ناقص أو نصف مبني من المرحلة 1

| البند | المشكلة |
|---|---|
| **مراجعة يدوية للبائع** | مبنية بالواجهة، **مكسورة بالصلاحيات** (بند 3-أ أدناه) |
| **الاشتراك المدفوع** | `TAP_SECRET_KEY` و`TAP_WEBHOOK_SECRET` فاضية — الفريميوم بلا "ثم اشتراك" |
| **إيقاف الإعلانات عند انتهاء الاشتراك** | غير موجود إطلاقًا (لا `vercel.json` ولا `pg_cron`) |
| **الإشعارات البريدية** | الكود كامل، لكن لا cron ولا مزوّد (`RESEND_API_KEY` غير مضبوط) |

### ⚠️ كود من مراحل متأخرة اتبنى قبل أوانه

هذا أكبر انحراف عن الخطة. من 39 هجرة مطبّقة، **~30 خارج المرحلة 1**، ومن 52 مسار، **~40 خارج المرحلة 1**:

| المرحلة حسب ROADMAP | ما اتبنى فعليًا |
|---|---|
| المرحلة 2 | `needs/`, `refer-a-business/`, `whats-new/`, `vouches`, `activity-indicator` |
| المرحلة 3 | `journey/`, `sponsorships/`, `admin/pulse`, `polls/`, `dashboard/referrals`, `events/`, `jobs/` |
| المرحلة 4+ / مؤجّل | `deals/`, `bids/`, `bookings/`, `payment-proofs`, `premium-tiers`, `milestone-badges`, `trust-levels`, `saved-searches`, `moderation` |
| مبرّر (تراجع موثّق) | `chat/` — المستخدم قرر إبقاءها لسبب خصوصية موثّق بـROADMAP |

**الأثر العملي:** كل هذي الصفحات ترجع HTTP 200 بالفحص لأن جداولها **فاضية تمامًا**
(`offers`, `events`, `jobs`, `polls`, `deals`, `need_requests`, `content_reports`, `chat_threads` — كلها صفر صف).
أول ما تدخل بيانات حقيقية، تنكشف أعطال زي بند 3-ج (كسر `/polls`). يعني الفحص السابق بجلسة حقيقية
أعطى إحساسًا زائدًا بالأمان: هو فحص قراءة، والأعطال كلها بالكتابة.

---

## 2. مطابقة القرارات التقنية المحسومة

### 🔴 `region_id` — غير مطبّق كما هو موثّق (خطورة: متوسطة الآن، حرجة وقت التوسع)

TECH.md يقول صراحة "`region_id` من اليوم الأول ... عشان التوسع بدون إعادة تصميم"، وROADMAP §5 يبني
فكرة "عزل الدِيَر" بالكامل فوقه. الواقع:

- ✅ موجود بـ`sellers` و`listings` و`neighborhoods` فقط (`supabase/migrations/00000000000001_initial_schema.sql:46,84`)
- ❌ **غير موجود بأي من الـ30+ جدول من الهجرة 18 إلى 53** — `offers`, `events`, `jobs`, `need_requests`, `questions`, `polls`, `deals`, `chat_threads`, `seller_bookings`, `content_reports`... كلها بلا `region_id`
- ❌ **صفر إشارة لـregion بكل كود التطبيق**: `grep -rn "region" app lib` = **0 نتيجة**. ولا استعلام واحد يفلتر بالمنطقة.

**الأثر:** "عزل البيع بين الدِيَر" مو "جاهز نفلتر ونخلص" — يحتاج `ALTER TABLE` على 30 جدول + إعادة كتابة كل استعلام.
والعمود الموجود بـ`listings` نفسه غير مستخدم: `app/dashboard/listings/new/actions.ts:61` ما يمرر `region_id` أصلاً،
يعتمد على `default 1`.

**الحل المباشر (وقت التنفيذ الفعلي، مو الآن):**
هجرة واحدة تضيف `region_id int not null default 1 references regions(id)` لكل الجداول ذات العلاقة،
+ دالة `current_region()` تُقرأ من subdomain/cookie، + فلترة افتراضية بـ`lib/data/*.ts`.
مؤجّل للمرحلة 5 — لكن **وثّق أن الجاهزية المدّعاة غير قائمة**، عشان ما تُبنى قرارات عليها.

### 🟡 الدردشة الداخلية — شغالة فعليًا، مو سكيلتون

فحصت `supabase/migrations/00000000000045_inapp_chat.sql` (231 سطر) + `app/dashboard/chat/[id]` + `app/my/chat/[id]` + `app/my/inbox`:

- ✅ جدولان كاملان بـtriggers لعدّاد غير المقروء وآخر رسالة (`chat_thread_denorm()`)
- ✅ RLS محكم: `select`/`insert` للطرفين فقط
- ✅ **الأمان ممتاز هنا**: `chat_upsert_thread()` يرفض فتح محادثة إلا مع بائع `verification_status='approved'` — يمنع أي مستخدم من إزعاج أي مستخدم بمجرد تمرير معرّفه (`:197-202`)
- ✅ نص الرسالة والمرسِل غير قابلين للتعديل (`revoke update` ثم `grant update (read_by_*)` — بالترتيب الصحيح)
- 🟡 **ناقص:** لا حد معدّل (rate limit) على إرسال الرسائل. جدول `interaction_log` موجود (هجرة 16) لكنه يخدم المشاهدات/النقرات فقط.

### 🟡 RLS — سليم بالجملة، عدا ثغرة الأدمن

- ✅ البائع يشوف بياناته بس: `listings_select_own`, `sellers_select_own`, `subscriptions_select_own` — كلها `= auth.uid()`
- ✅ المشتري ما يعدّل غير بياناته: مفروض بـRLS + حجب أعمدة
- ✅ `is_admin()` معرّفة بمكان واحد ومستخدمة بالـRLS وبالتطبيق (`lib/auth/permissions.ts:46`) — تصميم صح
- ✅ كل دوال `SECURITY DEFINER` عليها `SET search_path = public, pg_temp` (هجرة 15) — ثغرة تصعيد الصلاحيات مسدودة
- ✅ مفتاح `service_role` يُستخدم بمكان واحد فقط: `app/api/webhooks/tap/route.ts:12` — صحيح تمامًا
- 🔴 **لكن** 11 جدول بلا أي سياسة أدمن إطلاقًا (`content_reports`, `polls`, `favorite_listings`, `chat_*`, `deal_payments`, `seller_bookings`, `featured_listings`, `journeys`...)

---

## 3. ثغرات أمنية ومخاطر

### 🔴 أ. حجب الأعمدة يشلّ الأدمن — أخطر عطل بالمشروع

**الملفات:** `supabase/migrations/00000000000053_fix_column_revokes.sql:71-75` + `app/admin/actions.ts:29-33`
**الخطورة: حرجة — توقف الإطلاق**

الهجرة 53 صحيحة تمامًا بنيّتها (تسد ثغرة حقيقية: البائع كان يقدر يعتمد نفسه). لكنها تنفّذ:

```sql
revoke update on public.sellers from authenticated;
grant update (<كل الأعمدة عدا verification_status,...>) on public.sellers to authenticated;
```

**صلاحيات الأعمدة بـPostgres مرتبطة بالـrole لا بالصف.** والأدمن بـSupabase هو `authenticated` مثل أي مستخدم —
ما فيه role منفصل اسمه admin. سياسات RLS تحدد **أي صف** تقدر تلمسه، لكنها **لا تمنح صلاحية عمود**.

**تحقق حي على قاعدة الإنتاج:**
```
PATCH /rest/v1/sellers?id=eq.<id>  {"verification_status":"approved"}
→ 403 {"code":"42501","message":"permission denied for table sellers"}
```

**المسارات الميتة نتيجةً لهذا:**

| الملف | الدالة | العمود المحجوب | الأثر |
|---|---|---|---|
| `app/admin/actions.ts:22` | `setSellerVerification` | `sellers.verification_status` | **اعتماد البائع مستحيل** ← جوهر المرحلة 1 |
| `app/admin/actions.ts:83` | `setOfferStatus` | `offers.status` | نشر العرض مستحيل |
| `app/admin/actions.ts:57` | `setEventStatus` | `events.status` | نشر الفعالية مستحيل |
| `app/admin/moderation/moderation-actions.ts` | Q&A | `questions.status`, `answers.status` | اعتماد سؤال مستحيل |

*(`setListingStatus` و`setJobStatus` و`setReferralStatus` سليمة — أعمدتها مو ضمن القائمة المحجوبة.)*

**الحل المباشر (الأنظف):** دوال `SECURITY DEFINER` تتحقق من `is_admin()` بنفسها، وتُمنح لـ`authenticated`.
هذا يبقي الحجب ساري ضد البائع، ويفتح المسار للأدمن فقط:

```sql
create or replace function admin_set_seller_verification(p_seller_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'Unauthorized'; end if;
  if p_status not in ('approved','rejected','suspended','pending') then
    raise exception 'invalid status';
  end if;
  update sellers set verification_status = p_status where id = p_seller_id;
end $$;
grant execute on function admin_set_seller_verification(uuid, text) to authenticated;
```
ونفس النمط لـ`offers.status` و`events.status` و`questions.status`، ثم `app/admin/actions.ts` ينادي `.rpc()` بدل `.update()`.

### 🔴 ب. `app/admin/actions.ts` — يبتلع كل خطأ بصمت

**الملف:** `app/admin/actions.ts:29-33, 45-51, 64, 77, 90, 103`
**الخطورة: حرجة**

ولا واحدة من الـ6 دوال تفحص `error`:
```ts
await supabase.from("sellers").update({ verification_status: status }).eq("id", sellerId);
await logAdminAction(...);      // يُسجَّل "تم الاعتماد" حتى لو فشل التحديث
revalidatePath("/admin/sellers");
```
النتيجة: الأدمن يضغط "اعتماد"، الصفحة تتحدّث، البائع لا يزال `pending`، وسجل `admin_actions` يكذب.
**هذا بالضبط سبب عدم اكتشاف العطل (أ) بالفحص السابق.**

**الحل:** فحص `error` بكل دالة، رميه للأعلى، وعدم كتابة `admin_actions` إلا بعد نجاح فعلي.

### 🔴 ج. لوحة التدقيق `/admin/moderation` معطّلة كليًا

**الخطورة: عالية**
1. `moderation_stats()` — `grant execute ... to service_role` فقط (`migration 40:66-67`)، والصفحة تناديها بعميل الجلسة (`app/admin/moderation/page.tsx:12`) ← ترمي خطأ يُبتلع بـ`?? []` ← الإحصائيات صفر دائمًا.
2. `content_reports` **ما عليها سياسة SELECT للأدمن** — السياسة الوحيدة `reporter sees own report`. التعليق بالهجرة يقول "من خلال service role عبر صفحة الإدارة"، لكن الصفحة **ما تستخدم service role**. ← الأدمن يشوف صفر بلاغات إلى الأبد.

### 🔴 د. الإبلاغ عن إعلان يفشل دائمًا — تعارض أنواع

**الملفات:** `supabase/migrations/00000000000040_content_moderation.sql:9` + `app/admin/moderation/moderation-actions.ts:47`
**الخطورة: عالية**

```sql
target_id bigint not null,   -- لكن target_type يقبل 'listing'
```
و`listings.id` من نوع **uuid**. والكود:
```ts
target_id: typeof targetId === "string" ? Number(targetId) : targetId
```
`Number("<uuid>")` = `NaN` → يُسلسل JSON كـ`null` → انتهاك `not null`.
والاستخدام الوحيد لـ`ReportDialog` بالمشروع هو `targetType="listing"` (`app/listing/[slug]/page.tsx:181,187`) — **يعني الميزة مكسورة 100%**.

**الحل:** `alter table content_reports alter column target_id type text using target_id::text;` وحذف `Number()`.

### 🔴 هـ. أزرار `/admin/polls` معطّلة + `/polls` تنكسر بأول استفتاء

**الخطورة: عالية (لكن المرحلة 3)**
- `admin_create_weekly_poll()` و`close_poll_and_set_winner()` — `grant ... to service_role` فقط (`migration 38:112,205`) والصفحة عميل جلسة.
- `poll_results()` (`migration 38:133-141`) يعمل `left join profiles p` ثم يقرأ **`p.business_name` و`p.slug`** — وجدول `profiles` ما فيه هذين العمودين (موجودان بـ`sellers`). PL/pgSQL ما يتحقق من الأعمدة وقت الإنشاء، فالخطأ يظهر **وقت التشغيل فقط** ← `/polls` ترجع 500 أول ما يوجد استفتاء نشط.
- سياسة `polls` تشترط `auth.role() = 'authenticated'` ← الزائر غير المسجّل ما يشوف الاستفتاء رغم أن الصفحة عامة.

**الحل:** `left join sellers p` بدل `profiles`، ومنح الدالتين لـ`authenticated` مع فحص `is_admin()` بداخلهما (هما أصلاً يفحصان الدور).

### 🟠 و. لا يوجد cron — التزامان من TECH.md غير منفّذين

**الخطورة: عالية**
لا `vercel.json`، ولا `pg_cron`، ولا أي مُشغّل مجدول.
1. **انتهاء الاشتراك** (TECH.md §5/§6: "الزايد عن الحد المجاني يصير `paused`") — غير موجود. الاشتراك ينتهي بصمت والإعلانات تبقى منشورة مجانًا للأبد.
2. **`/api/email-worker`** — منطق كامل بـ`lib/email/worker.ts`، محمي بـbearer token بشكل صحيح، لكن **لا شيء يناديه**. وكذلك لا `RESEND_API_KEY` مضبوط. ← صفر إيميل.

**الحل:** `vercel.json` بـ`crons` (يومي للاشتراكات، كل 15 دقيقة للإيميل) — مجاني ضمن باقة Vercel.

### 🟡 ز. `listings_update_own` تمنع الإيقاف المؤقت

`migration 15:57-59` — `with check (... and status in ('pending_review','archived'))`.
حالتا `paused` و`draft` معرّفتان بالسكيما لكن البائع **ما يقدر يوصل لهما**. وأي مهمة إيقاف مستقبلية
لازم تشتغل بـ`service_role` أو `SECURITY DEFINER`. تصميم مقصود جزئيًا، لكن يستحق التوثيق.

### 🟡 ح. `middleware.ts` — سليم بالمبدأ

`matcher` يغطي `/dashboard`, `/admin`, `/my`, `/auth`, `/login`, `/notifications`, `/ask`, `/seller`.
غير مغطّاة: `/booking/*`, `/needs/new`, `/refer-a-business`, `/polls`, `/events`, `/jobs`, `/deals`.
**لكن هذا ليس ثغرة** — الملف نفسه يوثّق (وبحق، بسبب CVE-2025-29927) أنه "طبقة راحة لا حاجز أمني"،
وكل صفحة محمية تنادي `requireUser`/`requireSeller`/`requireAdmin` بنفسها. تحققت من هذا بالصفحات المحمية.
الأثر الوحيد: قد يُطلب من المستخدم تسجيل الدخول مرة زايدة بهذي المسارات لو انتهت الجلسة.

### ✅ ط. متغيرات البيئة — نظيفة

- `.gitignore:34` → `.env*` (باستثناء `.env.local.example`)
- `git log --all -- '.env*'` → لا شيء عدا `.env.local.example`
- `git grep "eyJhbGciOiJI"` على الملفات المتتبّعة → **صفر نتائج**
- `SUPABASE_SERVICE_ROLE_KEY` يُستعمل بملف واحد فقط وهو Route Handler سيرفري بحت ✅

---

## 4. جودة الكود والبنية

| # | المشكلة | الملف | الخطورة | الحل |
|---|---|---|---|---|
| 1 | **213 استخدام لـ`as any`** | كل المشروع | متوسطة | يعطّل TypeScript عند الحدود الأخطر (نتائج Supabase). ولّد الأنواع: `supabase gen types typescript` |
| 2 | ملفات ضخمة | `app/admin/moderation/moderation-client.tsx` (607)، `app/seller/[slug]/page.tsx` (555)، `app/dashboard/page.tsx` (552)، `app/page.tsx` (530) | متوسطة | تقسيم لمكوّنات عرض + نقل جلب البيانات لـ`lib/data/` |
| 3 | **مجلد route بلا `page.tsx`** | `app/deals/` (فيه `deals-client.tsx` و`deals-actions.ts` و`payment-actions.ts` فقط) | بسيطة | انقله لـ`components/deals/` — حاليًا مجرد مجلد استيراد يتنكر كمسار |
| 4 | تكرار قائمة الأسباب | `components/report-dialog.tsx:6-18` و`app/admin/moderation/moderation-actions.ts:7-18` — **نسختان حرفيًا** | بسيطة | ملف واحد بـ`lib/validation/report.ts`؛ لاحظ أن `getReasonList()` موجودة ولا تُستخدم |
| 5 | تتبع نقرات غير متسق | `app/seller/[slug]/page.tsx:339` رابط `wa.me` مباشر بلا تتبع، بينما صفحة الإعلان تتبع | متوسطة | استخدم نفس `WhatsappButton` — وإلا إحصائيات "كم عميل جبنا لك" ناقصة، وهي حجّة البيع للبائع |
| 6 | N+1 | لا يوجد فعليًا | — | ✅ فحصت `lib/data/*.ts` و`app/page.tsx`: يستخدمون `Promise.all` + embedding (`select("*, sellers(...)")`) كما أوصى TECH.md |
| 7 | الفهارس | ✅ جيدة | — | فهارس على `(status, category_id)`, `(seller_id, status)`, GIN على `details` و`search_text` |
| 8 | كود مؤقت | `lib/seo.ts:1` — `TODO` واحد فقط (اسم الموقع، قرار موثّق) | بسيطة | لا شيء — مقصود |
| 9 | بيانات تجريبية على الإنتاج | `demo-shop`, `demo-home-producer` + إعلانين (`منتج تجريبي`, `كيكة تجريبية`) | متوسطة | احذفهم قبل الإطلاق — الهجرة 17 نفسها تحذّر من هذا |
| 10 | شريط تنقل الجوال | `app/dashboard/dashboard-header.tsx` (11 رابط)، `app/admin/admin-header.tsx` (10) | بسيطة | نفس حل الهمبرغر بـ`components/site-nav.tsx` |

---

## 5. قائمة الجاهزية للإطلاق (المرحلة 1 فقط)

### 🔴 حاجز إطلاق — لا يُطلق قبلها

- [ ] **1. إصلاح اعتماد البائع** — دالة `admin_set_seller_verification()` بـ`SECURITY DEFINER` + `is_admin()`، وتحويل `app/admin/actions.ts` لـ`.rpc()`. *(بدونها لا يمكن اعتماد ولا بائع واحد)*
- [ ] **2. فحص الأخطاء بـ`app/admin/actions.ts`** — 6 دوال، كلها تبتلع الفشل بصمت. *(بدونها ستُخفى أي أعطال مستقبلية بنفس الطريقة)*
- [ ] **3. `vercel.json` بمهمة يومية** لإيقاف الإعلانات الزايدة عند انتهاء الاشتراك (TECH.md §6)
- [ ] **4. حذف البائعين والإعلانات التجريبية** من قاعدة الإنتاج

### 🟠 مهم — يُفضّل قبل الإطلاق

- [ ] **5. تفعيل Tap** (`TAP_SECRET_KEY` + `TAP_WEBHOOK_SECRET` بـ`.env.local` وبـVercel) — *معطّل خارجيًا برخصة العمل الحر. البديل المؤقت: صفحة "تواصل معنا للترقية" بدل زر دفع مكسور*
- [ ] **6. مزوّد إيميل + cron لـ`/api/email-worker`** — `RESEND_API_KEY` + إدخال بـ`crons`. بدونه البائع ما يعرف أن إعلانه اتنشر أو انرفض
- [ ] **7. `NEXT_PUBLIC_SITE_URL`** — فاضي بـ`.env.local` (مضبوط بـVercel). تأكد منه قبل الإطلاق لصحة روابط `sitemap`/JSON-LD
- [ ] **8. تتبع نقرة واتساب بصفحة البائع** (`app/seller/[slug]/page.tsx:339`)

### 🟡 نظافة — بعد الإطلاق مباشرة

- [ ] 9. همبرغر لشريط لوحة البائع والأدمن بالجوال
- [ ] 10. إصلاح `target_id` بجدول `content_reports` (`bigint` → `text`) + سياسة SELECT للأدمن + منح `moderation_stats()` لـ`authenticated`
- [ ] 11. إصلاح `poll_results()` (`profiles` → `sellers`) قبل إنشاء أي استفتاء
- [ ] 12. نقل `app/deals/` إلى `components/`
- [ ] 13. توحيد قائمة أسباب البلاغ بملف واحد
- [ ] 14. توليد أنواع Supabase وتقليل `as any`

### ⏸️ موثّق كمؤجّل (لا عمل الآن)

- `region_id` على الجداول 18-53 + فلترة المنطقة — **لكن صحّح التوثيق**: الجاهزية المدّعاة بـROADMAP §5 غير قائمة فعليًا
- كل ما بُني من المراحل 2-4 يبقى كما هو (لا فائدة من حذفه)، لكن **لا وقت إضافي عليه** قبل أن يعمل أساس المرحلة 1

---

## ملاحظة منهجية

الفحص السابق (44 مسار بجلسة حقيقية، كلها 200) كان **فحص قراءة**. كل الأعطال الحرجة أعلاه
بمسار **الكتابة**، ولا تظهر إلا بالضغط الفعلي على الأزرار. الفحص القادم لازم يشمل:
اعتماد بائع، نشر إعلان، إرسال بلاغ، إنشاء استفتاء — لا مجرد فتح الصفحات.
