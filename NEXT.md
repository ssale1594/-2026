# نقطة الاستئناف — آخر تحديث 2026-08-21

> **لجلسة جديدة:** اقرأ هذا الملف أولًا، ثم [AUDIT.md](AUDIT.md)، ثم كمّل من "المتبقي" أدناه بالترتيب.
> السطر الواحد اللي تبدأ فيه: *"اقرأ NEXT.md وكمّل من حيث توقفت"*.

---

## 🔴 مطلوب من صاحب المشروع (لا أقدر أسويه بنفسي)

هذي الأشياء الوحيدة الموقوفة عليك. كل شي غيرها أنا أقدر أكمله.

### 1. طبّق الهجرة 54 على Supabase — **الأهم، ما فيه شي يشتغل بدونها**
افتح [Supabase SQL Editor](https://supabase.com/dashboard/project/ownxrmyxbryizpynrzrb/sql)،
والصق **كامل** محتوى `supabase/migrations/00000000000054_admin_write_paths.sql` ثم Run.

⚠️ الصقه **كاملًا دفعة واحدة** — محرر Supabase ينفّذ اللصقة كمعاملة واحدة، فأي خطأ يلغي كل شي.
لو طلع خطأ، انسخ نص الخطأ وأعطني إياه.

**قبل تطبيقها:** لوحة الإدارة تطلع خطأ عند أي ضغطة زر (لأن الكود صار ينادي دوال لسه غير موجودة).
**بعد تطبيقها:** اعتماد البائع والعروض والفعاليات والتدقيق والاستفتاءات كلها تشتغل.

### 2. أضف متغيّر `CRON_SECRET` على Vercel
```
npx vercel env add CRON_SECRET production
```
والقيمة: أي نص عشوائي طوله 32 حرف أو أكثر. بدونه المهام المجدولة ترفض التشغيل عمدًا
(أفضل من مسار مفتوح يعدّل الإعلانات ويرسل بريد).

### 3. (اختياري الآن) مزوّد بريد
`npx vercel env add RESEND_API_KEY production` — بدونه الإشعارات تبقى داخل الموقع فقط بلا إيميل.

### 4. (موقوف خارجيًا) Tap
`TAP_SECRET_KEY` و`TAP_WEBHOOK_SECRET` — معلّقة على رخصة العمل الحر. لا شي أسويه هنا.

### 5. قرار منك: حذف البيانات التجريبية
`demo-shop` و`demo-home-producer` وإعلانيهما هم **المحتوى الوحيد** بالموقع الآن.
حذفهم الحين يخلّي الموقع فاضي تمامًا. اتركهم لين يسجّل أول بائع حقيقي، وبعدها:
`supabase/migrations/00000000000056_remove_demo_data.sql` جاهزة للصق.

---

## ✅ خلص (مرفوع على GitHub)

| # | الإصلاح | الملف |
|---|---|---|
| 1 | **اعتماد البائع** — 9 دوال `SECURITY DEFINER` بدل UPDATE مباشر | `migrations/…54` + `app/admin/actions.ts` |
| 2 | فحص أخطاء بكل إجراء إداري (كان يبتلع الفشل ويكتب سجل تدقيق كاذب) | `app/admin/actions.ts`, `app/admin/review-buttons.tsx` |
| 3 | `admin_actions` — `target_type` موسّع و`target_id` صار نصًا (كل سطر تدقيق كان يفشل) | `migrations/…54` |
| 4 | عمود `rejection_reason` الناقص على `listings` و`sellers` | `migrations/…54` |
| 5 | حظر البائع كان يحدّث `profiles` بأعمدة موجودة بـ`sellers` | `moderation-actions.ts` |
| 6 | لوحة التدقيق — سياسة SELECT للأدمن + منح `moderation_stats()` | `migrations/…54` |
| 7 | الإبلاغ عن إعلان — `target_id` من `bigint` إلى `text` (كان `Number(uuid)=NaN`) | `migrations/…54` |
| 8 | `poll_results()` كانت تقرأ من `profiles` بدل `sellers` → كسر `/polls` | `migrations/…54` |
| 9 | أزرار الاستفتاءات ممنوحة لـ`authenticated` + الزائر يشوف الاستفتاء | `migrations/…54` |
| 10 | **انتهاء الاشتراك** — `expire_due_subscriptions()` + مسار cron + `vercel.json` | `migrations/…54`, `app/api/cron/…` |
| 11 | عامل البريد كان يستخدم عميل الجلسة بدل service_role → صفر إيميل دائمًا | `lib/email/worker.ts`, `lib/supabase/service.ts` |
| 12 | همبرغر للجوال بلوحة البائع (13 رابط) والأدمن (11 رابط) | `components/nav-menu.tsx` |
| 13 | توحيد قائمة أسباب البلاغ بملف واحد | `lib/validation/report.ts` |
| 14 | نقل `app/deals/` → `components/deals/` (مجلد route بلا page) | — |

---

## ⏭️ المتبقي — كمّل من هنا بالترتيب

### أ. إصلاحات صغيرة باقية
- [ ] تتبع نقرة واتساب بصفحة البائع (`app/seller/[slug]/page.tsx`) — يحتاج جدول `seller_contact_clicks` بهجرة 55
- [ ] `NEXT_PUBLIC_SITE_URL` فاضي بـ`.env.local` محليًا
- [ ] تقليل `as any` (213 موضع) — ولّد أنواع Supabase
- [ ] تقسيم الملفات الضخمة (`moderation-client.tsx` 607 سطر، `seller/[slug]/page.tsx` 555)

### ب. أفكار المرحلة 2 (الأولوية القصوى بعد الإطلاق)
راجع القائمة الكاملة والحالة الفعلية لكل فكرة في [IDEAS.md](IDEAS.md).

### ج. المرحلة 3 و5
نفس الملف.

---

## ملاحظات تشغيلية

- **لا تحفظ أي شي على قرص C** — استخدم D فقط (القرص C أقل من 3GB فاضي).
- الرفع التلقائي لـGitHub بعد كل تعديل ذو معنى (CLAUDE.md) — بدون انتظار تأكيد.
- محرر Supabase SQL ينفّذ اللصقة كاملة كمعاملة واحدة: أي خطأ = تراجع كامل. قسّم اللصقات الكبيرة.
- `npm run build` و`npm run dev` ما يشتغلون بنفس الوقت (يفسدون `.next`).
