import { createClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth/permissions";
import Link from "next/link";
import { siteName } from "@/lib/seo";
import { ensureFreeSubscriptionRow, requestFeaturedListing, simulateUpgradeTier, setSubscriptionAutoRenew } from "./subscription-actions";
import SubscriptionClient from "./subscription-client";

export const metadata = {
  title: `العضوية المميزة - لوحة التحكم - ${siteName}`,
  description: "إدارة عضويتك، ترقية طبقتك، واستخدام حصص تعزيز الإعلانات.",
};

const TIER_DEFS = [
  {
    tier: "free" as const,
    name: "العضوية المجانية",
    price: 0,
    color: "from-neutral-100 to-white dark:from-neutral-800 dark:to-neutral-900",
    border: "border-neutral-300 dark:border-white/10",
    perks: [
      "10 إعلانات منشورة كحد أقصى",
      "التسجيل والوصول الأساسي",
      "الاتصال عبر واتساب والدردشة",
      "مؤشر الثقة الأساسي",
    ],
  },
  {
    tier: "silver" as const,
    name: "العضوية الفضية",
    price: 149,
    color: "from-neutral-100 via-white to-slate-100 dark:from-slate-900/40 dark:via-neutral-900 dark:to-slate-900/40",
    border: "border-neutral-400/60",
    badge: "🥈 الأكثر شيوعاً للبائعين المبتدئين",
    perks: [
      "حد أقصى 30 إعلان منشور",
      "1 إعلان مميز شهرياً (مدة 7 أيام)",
      "شارة عضوية فضية على ملفك",
      "أولوية متوسطة في نتائج البحث",
      "دعم عادي عبر البريد",
    ],
  },
  {
    tier: "gold" as const,
    name: "العضوية الذهبية",
    price: 349,
    color: "from-amber-50 via-white to-amber-50 dark:from-amber-950/40 dark:via-neutral-900 dark:to-amber-950/40",
    border: "border-amber-500/50",
    badge: "🥇 الأفضل لبائعي المحلات والمنشئين",
    highlight: true,
    perks: [
      "حد أقصى 100 إعلان منشور",
      "3 إعلانات مميزة شهرياً",
      "شارة ذهبية على ملفك وبطاقات إعلاناتك",
      "أولوية عالية جداً في نتائج البحث",
      "الدعم الفوري عبر الواتساب الرسمي",
      "تحليل أداء الإعلانات الأسبوعي",
    ],
  },
  {
    tier: "diamond" as const,
    name: "عضوية الماس",
    price: 799,
    color: "from-sky-50 via-white to-fuchsia-50 dark:from-sky-950/40 dark:via-neutral-900 dark:to-fuchsia-950/40",
    border: "border-sky-500/40",
    badge: "💎 للأكبر والأقوى في السوق",
    perks: [
      "إعلانات غير محدودة",
      "10 إعلانات مميزة شهرياً + شارات حصرية",
      "شارة الماس المتلألئة",
      "أعلى أولوية في نتائج البحث والرئيسية",
      "مدير حساب مخصص 24/7",
      "تضمين ملفك في قسم «كبار البائعين» الأسبوعي",
      "إحصائيات وتقارير شهرية مفصلة",
    ],
  },
];

export default async function SubscriptionPage() {
  const seller = await requireSeller();
  const supabase = await createClient();
  // ضمان وجود صف (لتجنب null في أول زيارة):
  await ensureFreeSubscriptionRow();

  const [{ data: subQ }, { data: listings }, canPubQ] = await Promise.all([
    (supabase.rpc as any)("get_seller_subscription", { p_seller_id: seller.id }),
    supabase
      .from("listings")
      .select("id, title, slug, status, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(100),
    (supabase.rpc as any)("can_publish_listing", { p_seller_id: seller.id }),
  ]);

  const sub = (subQ as any[])?.[0] ?? {
    tier: "free",
    active_listing_limit: 10,
    can_featured_ad: false,
    featured_quota_monthly: 0,
    premium_badge_level: 0,
    status: "active",
    days_left: null,
    expires_at: null,
  };
  const published = (listings ?? []).filter((l: any) => l.status === "published");
  const featuredActiveIds = new Set<number>();
  const canPublish = (canPubQ?.data as any[])?.[0] ?? {
    allowed: published.length < 10,
    current_count: published.length,
    tier_limit: sub.active_listing_limit ?? 10,
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-black dark:text-white">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <nav className="text-xs text-black/50 dark:text-white/50 mb-3">
            <Link href="/" className="hover:underline">الرئيسية</Link> /{" "}
            <Link href="/dashboard" className="hover:underline">لوحة التحكم</Link> /{" "}
            <b>العضوية المميزة</b>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold inline-flex items-center gap-3">
                👑 العضوية المميزة
              </h1>
              <p className="text-sm text-black/60 dark:text-white/60 mt-2 max-w-2xl">
                رفع ملفك إلى مصاف كبار البائعين: حد إعلانات أكبر، شارات مميزة في
                جميع أنحاء المنصة، ونسب ظهور أعلى في البحث والرئيسية.
              </p>
            </div>
            <Link
              href={`/seller/${seller.slug}`}
              className="text-sm rounded-lg bg-black/5 dark:bg-white/10 px-4 py-2 hover:bg-black/10 dark:hover:bg-white/15 font-semibold border border-black/[.1] dark:border-white/15"
            >
              معاينة ملفك العام ←
            </Link>
          </div>
        </header>

        {/* Current Subscription Summary */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-50 via-white to-indigo-50 dark:from-indigo-950/30 dark:via-neutral-900 dark:to-indigo-950/30">
            <div className="text-xs opacity-60 mb-1">طبقتك الحالية</div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-2xl font-extrabold">{TIER_DEFS.find(t => t.tier === sub.tier)?.name ?? "المجانية"}</div>
              {sub.tier !== "free" && (
                <span className="text-xs rounded-full border border-black/[.12] dark:border-white/[.2] px-2 py-0.5">
                  الحالة: {sub.status === "active" ? "✅ نشطة" : `حالة ${sub.status}`}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-sm">
              <div>
                <div className="opacity-60 text-[11px] mb-0.5">الإعلانات</div>
                <div className="font-bold">
                  {canPublish.current_count} / {canPublish.tier_limit}
                </div>
              </div>
              <div>
                <div className="opacity-60 text-[11px] mb-0.5">تعزيزات متبقية</div>
                <div className="font-bold">
                  {Math.max(0, (sub.featured_quota_monthly ?? 0) - (sub.features_used_featured ?? 0))} / {sub.featured_quota_monthly ?? 0}
                </div>
              </div>
              <div>
                <div className="opacity-60 text-[11px] mb-0.5">التجديد التلقائي</div>
                <div className="font-bold">{sub.auto_renew ? "✅ مفعل" : "— غير مفعل"}</div>
              </div>
              <div>
                <div className="opacity-60 text-[11px] mb-0.5">تبقى من الصلاحية</div>
                <div className="font-bold">
                  {sub.days_left == null ? "غير محدد" : `${sub.days_left} يوم`}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 p-4 bg-emerald-50/60 dark:bg-emerald-950/20">
            <div className="text-xs opacity-60 mb-1">حد الإعلانات</div>
            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {canPublish.tier_limit}
            </div>
            <div className="mt-2 text-xs opacity-75">
              {canPublish.allowed
                ? `يمكنك نشر ${Math.max(0, canPublish.tier_limit - canPublish.current_count)} إعلان إضافي.`
                : "⚠️ وصلت للحد الأقصى — ترقِ العضوية لزيادة الحد."}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/40 p-4 bg-amber-50/60 dark:bg-amber-950/20">
            <div className="text-xs opacity-60 mb-1">ميزة الإعلانات المميزة</div>
            <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
              {sub.can_featured_ad ? "✅ مفعّلة" : "— غير مفعّلة"}
            </div>
            <div className="mt-2 text-xs opacity-75">
              {sub.can_featured_ad
                ? `حصتك: ${Math.max(0, (sub.featured_quota_monthly ?? 0) - (sub.features_used_featured ?? 0))} تعزيزات متوفرة هذا الشهر.`
                : "ترقِ للذهبية فأعلى لتفعيلها."}
            </div>
          </div>
        </section>

        {/* Tiers Cards */}
        <section className="mb-10">
          <h2 className="text-xl font-extrabold mb-4 inline-flex items-center gap-2">
            🎟️ اختر الطبقة المناسبة لك
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIER_DEFS.map((t) => {
              const isCurrent = t.tier === sub.tier;
              return (
                <div
                  key={t.tier}
                  className={[
                    "rounded-2xl border p-5 relative flex flex-col",
                    `bg-gradient-to-br ${t.color}`,
                    t.border,
                    isCurrent ? "ring-2 ring-indigo-600" : "",
                  ].join(" ")}
                >
                  {t.highlight && (
                    <span className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-amber-500 text-white text-[10px] font-bold px-2.5 py-0.5 shadow">
                      ⭐ الأكثر ترويجاً
                    </span>
                  )}
                  <div className="text-sm opacity-70 mb-1">{t.name}</div>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-extrabold">{t.price}</span>
                    <span className="opacity-60 text-xs">ر.س / شهرياً</span>
                  </div>
                  {t.badge && (
                    <div className="text-[11px] opacity-70 mb-3">{t.badge}</div>
                  )}
                  <ul className="space-y-1.5 mb-5 text-sm flex-grow">
                    {t.perks.map((p, i) => (
                      <li key={i} className="inline-flex gap-2">
                        <span className="text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5">✓</span>
                        <span className="text-black/80 dark:text-white/80">{p}</span>
                      </li>
                    ))}
                  </ul>
                  <SubscriptionClient
                    currentTier={sub.tier as any}
                    thisTier={t.tier as any}
                    price={t.price}
                    simulateUpgradeTier={simulateUpgradeTier}
                    setSubscriptionAutoRenew={setSubscriptionAutoRenew}
                    autoRenew={!!sub.auto_renew}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-[11px] opacity-55 mt-3 max-w-2xl">
            ملاحظة للأصغراء: زر "ترقية الآن" هو وضع ديمو فقط — في البيئة الانتاجية
            سنربطه مباشرة ببوابة Tap Payments السعودية لتحصيل المبالغ عبر بطاقات
            مدى/فيزا أو حوالات سلسلة المدفوعات الحكومية، مع إصدار فواتير ضريبية.
          </p>
        </section>

        {/* Featured section */}
        <section className="mb-10">
          <h2 className="text-xl font-extrabold mb-2 inline-flex items-center gap-2">
            ✨ إعلاني المميّز
          </h2>
          <p className="text-sm opacity-65 mb-4 max-w-2xl">
            الإعلان المميّز يظهر في قسم "🔥 عروض اليوم" في الصفحة الرئيسية مع
            إطار ذهبي، ويزداد احتمال ظهوره في نتائج البحث بنسبة تصل لـ 8×. صلاحية
            التعزيز 7 أيام من الطلب.
          </p>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20 p-5">
            {!sub.can_featured_ad ? (
              <div className="text-sm">
                ⚠️ طبقتك الحالية لا تدعم تعزيز الإعلانات. ترقِ للذهبية فأعلى لاستخدام هذه الميزة.
              </div>
            ) : published.length === 0 ? (
              <div className="text-sm opacity-70">
                قم أولاً بنشر إعلان ليظهر هنا ليتم تعزيزه.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {published.map((l: any) => (
                  <div
                    key={l.id}
                    className="rounded-xl border border-amber-500/20 bg-white/80 dark:bg-neutral-900/80 p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/listing/${l.slug}`}
                        className="font-semibold text-sm block truncate hover:underline"
                      >
                        {l.title}
                      </Link>
                      <div className="text-[11px] opacity-60 mt-0.5">
                        أنشئ: {new Date(l.created_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await requestFeaturedListing(l.id, 7);
                      }}
                      className="shrink-0"
                    >
                      <button
                        type="submit"
                        className={[
                          "rounded-full text-xs font-bold px-3 py-1.5",
                          featuredActiveIds.has(l.id)
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-200 cursor-default"
                            : "bg-amber-500 hover:bg-amber-600 text-white shadow",
                        ].join(" ")}
                        disabled={featuredActiveIds.has(l.id)}
                      >
                        {featuredActiveIds.has(l.id) ? "✨ مميّز" : "⚡ عِزّز الإعلان"}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
