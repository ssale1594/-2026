import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "./dashboard-header";
import DashboardClientStats from "./dashboard-client-stats";
import ArchiveButton from "./archive-button";
import { siteName } from "@/lib/seo";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending_review: "قيد المراجعة",
  published: "منشور",
  rejected: "مرفوض",
  paused: "متوقف",
  expired: "منتهي",
  archived: "مؤرشف",
};

const KPI_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  "مشاهدات الإعلانات": { label: "مشاهدات", icon: "👁️", color: "sky" },
  "نقرات واتساب (الاتصالات)": { label: "اتصالات واتساب", icon: "💬", color: "emerald" },
  "عدد الإعلانات": { label: "إعلانات منشورة", icon: "📦", color: "amber" },
  "التقييمات": { label: "تقييمات العملاء", icon: "⭐", color: "rose" },
  "التوصيات المجتمعية": { label: "توصيات الجيران", icon: "💚", color: "violet" },
  "ردود على احتياجاتي": { label: "ردودي على طلبات", icon: "📩", color: "indigo" },
};

const COLORS: Record<string, string> = {
  sky: "from-sky-500/10 to-sky-500/0 text-sky-700 border-sky-500/20",
  emerald: "from-emerald-500/10 to-emerald-500/0 text-emerald-700 border-emerald-500/20",
  amber: "from-amber-500/10 to-amber-500/0 text-amber-700 border-amber-500/20",
  rose: "from-rose-500/10 to-rose-500/0 text-rose-700 border-rose-500/20",
  violet: "from-violet-500/10 to-violet-500/0 text-violet-700 border-violet-500/20",
  indigo: "from-indigo-500/10 to-indigo-500/0 text-indigo-700 border-indigo-500/20",
};

export default async function DashboardPage() {
  const seller = await requireSeller();
  const supabase = await createClient();
  const generatedAt = new Date().toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });

  const [listingsQ, kpisQ, dailyQ, perfQ, trustQ, subsQ] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, slug, status, price, view_count, contact_click_count, listing_images(storage_path, is_primary), categories(name_ar)")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("seller_overall_kpis", { p_seller_id: seller.id }),
    supabase.rpc("seller_daily_stats", { p_seller_id: seller.id, p_days: 30 }),
    supabase.rpc("seller_performance_percentile", { p_seller_id: seller.id }),
    supabase.rpc("seller_trust", { p_seller_id: seller.id }),
    supabase
      .from("subscriptions")
      .select("id, status, current_period_end")
      .eq("seller_id", seller.id)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const listings = listingsQ.data ?? [];
  const kpis = (kpisQ.data as any[]) ?? [];
  const daily = (dailyQ.data as any[]) ?? [];
  const perf = (perfQ.data as any[])?.[0] ?? null;
  const trust = (trustQ.data as any[])?.[0] ?? null;
  const activeSubscription = subsQ.data;

  const reachedLimit =
    !activeSubscription &&
    seller.active_listings_count >= seller.free_listing_limit;

  const stats = {
    generatedAt,
    sellerName: seller.business_name,
    sellerSlug: seller.slug,
    trustLevel: trust?.level ?? 0,
    trustLabel: trust?.label ?? "جديد",
    avgRating: trust?.average_rating ?? null,
    confirmedDeals: trust?.confirmed_deals ?? 0,
    vouchCount: trust?.vouch_count ?? 0,
    subscriptionActive: activeSubscription?.status === "active" && new Date(activeSubscription.current_period_end) > new Date(),
    subscriptionEndsAt: activeSubscription?.current_period_end ?? null,
    kpis,
    daily: daily.map((d) => ({
      date: typeof d.day === "string" ? new Date(d.day).toISOString() : d.day.toISOString(),
      views: Number(d.views),
      contacts: Number(d.contacts),
      listings: Number(d.listings_published),
    })),
    performance: perf,
  };

  // Best & worst performers
  const publishedListings = listings
    .filter((l) => l.status === "published")
    .map((l: any) => ({
      id: l.id,
      title: l.title,
      slug: l.slug,
      price: l.price,
      status: l.status,
      views: Number(l.view_count),
      contacts: Number(l.contact_click_count),
      hasImage: (l.listing_images?.length ?? 0) > 0,
      category: (l.categories as any)?.name_ar ?? null,
      contactRate:
        l.view_count > 0
          ? Math.round((Number(l.contact_click_count) / Number(l.view_count)) * 1000) / 10
          : 0,
    }));

  const best3 = [...publishedListings].sort((a, b) => b.contacts - a.contacts).slice(0, 3);
  const needsImprovement = [...publishedListings]
    .filter((l) => l.views > 10 && l.contactRate < 3)
    .sort((a, b) => a.contactRate - b.contactRate)
    .slice(0, 3);

  // Tips based on data
  const tips: { title: string; detail: string; level: "info" | "success" | "warn" }[] = [];
  if (publishedListings.some((l) => !l.hasImage)) {
    tips.push({
      level: "warn",
      title: "إعلاناتك بدون صور!",
      detail: "الإعلانات اللي مع صور تجيب 4 أضعاف المشاهدات. أضف صور واضحة لكل إعلان.",
    });
  }
  const needsPrice = publishedListings.filter((l) => l.price == null);
  if (needsPrice.length >= 2) {
    tips.push({
      level: "warn",
      title: `${needsPrice.length} إعلانات بلا سعر`,
      detail: "العملاء يفضّلون معرفة السعر مسبقًا، حتى لو كان تقريبيًا.",
    });
  }
  if (needsImprovement.length > 0) {
    tips.push({
      level: "warn",
      title: `${needsImprovement.length} إعلانات مشاهداتها عالية لكن نادراً ما يتم الاتصال`,
      detail: "جرب تحسين الوصف أو خفض السعر أو إضافة صور أفضل لهذه الإعلانات.",
    });
  }
  if (stats.performance?.percentile_value > 0.66) {
    tips.push({
      level: "success",
      title: "🎉 أداء أعلى من " + Math.round(stats.performance.percentile_value) + "% من الباعة",
      detail: "استمر بالجودة والاستجابة السريعة على الواتساب — التقييمات الجيدة تجيب المزيد من العملاء.",
    });
  }
  if (!stats.subscriptionActive && seller.active_listings_count > 0) {
    tips.push({
      level: "info",
      title: "ترقية الاشتراك = حد إعلانات غير محدود + ظهور مميز",
      detail: "اشترك الآن واستخدم رمز السنة الأولى لخصم 6 أشهر مجانية.",
    });
  }
  if (publishedListings.length < 5) {
    tips.push({
      level: "info",
      title: "أضف المزيد من الإعلانات!",
      detail: "الباعة اللي لديهم 10+ إعلانات يحصلون على 3 أضعاف الزيارات مقارنة بمن عندهم أقل من 5.",
    });
  }
  if (trust?.level !== undefined && trust.level < 2) {
    tips.push({
      level: "info",
      title: "ارفع مستوى الثقة في حسابك",
      detail: "اطلب من جيرانك أو عملائك السابقين أن يوصوا بحسابك، أكد المعاملات مع عملائك — كل ذلك يرفع مستوى الثقة ويزيد المبيعات.",
    });
  }

  return (
    <>
      {/* The print rules for this page live in globals.css — styled-jsx pulls in
          `client-only`, which cannot be imported from a Server Component. */}
      <div className="min-h-screen font-sans">
        <DashboardHeader sellerName={seller.business_name} />

        <main className="mx-auto max-w-6xl px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold">مرحباً، {seller.business_name} 👋</h1>
                <span className="text-xs rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2.5 py-0.5 font-bold">
                  مستوى الثقة {stats.trustLevel} — {stats.trustLabel}
                </span>
                {stats.avgRating != null && (
                  <span className="text-xs rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 font-bold">
                    ⭐ {Number(stats.avgRating).toFixed(1)} ({stats.confirmedDeals} تعامل)
                  </span>
                )}
                {stats.subscriptionActive ? (
                  <span className="text-xs rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 font-bold">
                    ✓ اشتراك فعال
                  </span>
                ) : seller.verification_status === "approved" ? (
                  <span className="text-xs rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 font-medium">
                    مجاني (الحد: {seller.free_listing_limit})
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-black/60 dark:text-white/60">
                لوحة أدائك في {siteName} — آخر تحديث {generatedAt}
              </p>
            </div>
            <div className="no-print flex items-center gap-2 flex-wrap">
              <Link
                href={`/seller/${seller.slug}`}
                className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 inline-flex items-center gap-2"
              >
                👀 عرض صفحتي العامة
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-sm rounded-lg bg-foreground text-background px-4 py-2 inline-flex items-center gap-2 hover:opacity-90 font-semibold"
              >
                📄 تصدير تقرير الأداء PDF
              </button>
            </div>
          </div>

          {seller.verification_status !== "approved" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm mb-6">
              حسابك قيد المراجعة — إعلاناتك ما تظهر للزوار لين يتم اعتماد الحساب.
            </div>
          )}

          {/* KPI Cards */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">📈 ملخص الأداء</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {kpis.map((kpi) => {
                const info = KPI_LABELS[kpi.kpi];
                if (!info) return null;
                const cls = COLORS[info.color] || COLORS.sky;
                const trend = kpi.value_7d > 0 ? "+" : "";
                return (
                  <div
                    key={kpi.kpi}
                    className={`rounded-2xl border p-4 bg-gradient-to-br ${cls}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium">{info.label}</span>
                      <span aria-hidden className="text-lg">{info.icon}</span>
                    </div>
                    <div className="text-2xl font-bold leading-none mb-1.5">
                      {Number(kpi.value_30d).toLocaleString("ar-SA")}
                    </div>
                    <div className="text-[11px] opacity-80">
                      آخر 7 أيام: <span className="font-bold">{trend}{Number(kpi.value_7d).toLocaleString("ar-SA")}</span>
                      <span className="block opacity-70 mt-0.5">
                        الكلي: {Number(kpi.value_total).toLocaleString("ar-SA")}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Conversion rate summary */}
              <div className="rounded-2xl border p-4 bg-gradient-to-br from-rose-500/10 to-rose-500/0 border-rose-500/20 text-rose-700 dark:text-rose-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">
                    معدل التحويل مشاهدة → اتصال
                  </span>
                  <span aria-hidden>🎯</span>
                </div>
                <div className="text-2xl font-bold leading-none mb-1.5">
                  {stats.performance?.seller_contact_rate != null
                    ? `${Number(stats.performance.seller_contact_rate).toFixed(1)}%`
                    : "-"}
                </div>
                <div className="text-[11px] opacity-80">
                  متوسط باعة الفئة:{" "}
                  <b>
                    {stats.performance?.contact_rate_avg != null
                      ? `${Number(stats.performance.contact_rate_avg).toFixed(1)}%`
                      : "-"}
                  </b>
                </div>
              </div>
            </div>
          </section>

          {/* Client chart + Performance card */}
          <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DashboardClientStats daily={stats.daily} />
            </div>
            <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-5 bg-white dark:bg-black/10 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold mb-1 inline-flex items-center gap-2">
                  🏆 مقارنة أدائك
                </h3>
                <p className="text-xs text-black/50 mb-4">
                  مقارنة بـباعة نفس الفئة في المنصة
                </p>
                <div className="mb-3">
                  <div className="text-3xl font-bold mb-0.5">
                    {stats.performance?.percentile_value != null
                      ? Math.round(Number(stats.performance.percentile_value))
                      : 0}%
                  </div>
                  <div className="text-sm font-semibold">
                    {stats.performance?.percentile_label || "لا بيانات كافية"}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-black/[.06] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
                    style={{
                      width:
                        (stats.performance?.percentile_value
                          ? Math.min(100, Number(stats.performance.percentile_value))
                          : 0) + "%",
                    }}
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <Row label="متوسط مشاهدات/باعة الفئة" value={stats.performance?.view_count_avg != null ? Math.round(Number(stats.performance.view_count_avg)).toLocaleString("ar-SA") : "-"} />
                  <Row label="مشاهداتك الكلية" value={(kpis.find((k) => k.kpi === "مشاهدات الإعلانات")?.value_total ?? 0).toLocaleString("ar-SA")} />
                  <Row label="توصيات الجيران" value={`${stats.vouchCount} توصية`} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-black/[.06]">
                <Link
                  href="/dashboard/subscription"
                  className="block text-center rounded-xl bg-sky-600 hover:bg-sky-700 text-white py-2.5 text-sm font-semibold transition"
                >
                  ⬆️ رفع أدائي وترقية الاشتراك
                </Link>
              </div>
            </div>
          </section>

          {/* Tips + Best/Worst */}
          <section className="mb-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-black/[.08] dark:border-white/[.145] p-5 bg-white dark:bg-black/10">
              <h3 className="font-semibold mb-3 inline-flex items-center gap-2">
                💡 نصائح الأسبوع
              </h3>
              {tips.length === 0 ? (
                <p className="text-sm text-black/50">
                  أدائك ممتاز! لا نصائح حاليًا — واصل ما أنت عليه.
                </p>
              ) : (
                <ul className="space-y-3">
                  {tips.map((tip, i) => {
                    const cls =
                      tip.level === "warn"
                        ? "bg-amber-500/10 border-amber-500/30"
                        : tip.level === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-sky-500/10 border-sky-500/30";
                    const icon = tip.level === "warn" ? "⚠️" : tip.level === "success" ? "✅" : "ℹ️";
                    return (
                      <li key={i} className={`rounded-xl border ${cls} p-3`}>
                        <div className="flex items-center gap-2 text-sm font-bold mb-0.5">
                          <span aria-hidden>{icon}</span>
                          {tip.title}
                        </div>
                        <div className="text-xs leading-relaxed text-black/70 dark:text-white/70">
                          {tip.detail}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="lg:col-span-3 rounded-2xl border border-black/[.08] dark:border-white/[.145] p-5 bg-white dark:bg-black/10">
              <h3 className="font-semibold mb-3 inline-flex items-center gap-2">
                🔥 أفضل الإعلانات أداءً هذا الشهر
              </h3>
              {best3.length === 0 ? (
                <p className="text-sm text-black/50">
                  ما فيه إعلانات منشورة بعد. ابدأ بإضافة أول إعلان!
                </p>
              ) : (
                <ul className="space-y-2">
                  {best3.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent p-3 border border-emerald-500/15"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                        #{best3.indexOf(l) + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/listing/${l.slug}`}
                          className="font-semibold text-sm truncate block hover:underline"
                        >
                          {l.title}
                        </Link>
                        <div className="text-[11px] text-black/50 mt-0.5 flex flex-wrap gap-x-3">
                          <span>👁️ {l.views}</span>
                          <span>💬 {l.contacts}</span>
                          <span>🎯 {l.contactRate}%</span>
                          {l.category && <span>📂 {l.category}</span>}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Link
                          href={`/dashboard/listings/${l.id}/edit`}
                          className="no-print text-xs rounded-md border border-black/15 dark:border-white/20 px-2 py-1 hover:bg-black/5"
                        >
                          تعديل
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {needsImprovement.length > 0 && (
                <>
                  <h4 className="font-semibold mt-6 mb-3 text-sm inline-flex items-center gap-2">
                    ⚠️ هذه الإعلانات تحتاج تحسين
                    <span className="text-xs font-normal text-black/50">
                      مشاهدات كثيرة لكن اتصالات قليلة
                    </span>
                  </h4>
                  <ul className="space-y-2">
                    {needsImprovement.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent p-3 border border-amber-500/15"
                      >
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/listing/${l.slug}`}
                            className="font-semibold text-sm truncate block hover:underline"
                          >
                            {l.title}
                          </Link>
                          <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-3">
                            <span className="text-amber-700 dark:text-amber-300 font-bold">
                              معدل الاتصالات: {l.contactRate}% فقط
                            </span>
                            <span className="text-black/50">👁️ {l.views} مشاهدة فقط → 💬 {l.contacts} اتصال</span>
                          </div>
                        </div>
                        <div className="shrink-0 no-print">
                          <Link
                            href={`/dashboard/listings/${l.id}/edit`}
                            className="text-xs rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2 py-1 font-bold hover:bg-amber-500/30"
                          >
                            حسّن الإعلان
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          {/* Add listing CTA + listings */}
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-semibold">إعلاناتي</h2>
                <p className="text-sm text-black/60 dark:text-white/60 mt-1">
                  {seller.active_listings_count} من {seller.free_listing_limit} إعلان منشور
                </p>
              </div>
              {reachedLimit ? (
                <Link
                  href="/dashboard/subscription"
                  className="text-sm text-blue-600 hover:underline"
                >
                  وصلت الحد المجاني — اشترك لإضافة المزيد
                </Link>
              ) : (
                <Link
                  href="/dashboard/listings/new"
                  className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2"
                >
                  إضافة إعلان
                </Link>
              )}
            </div>

            {!listings || listings.length === 0 ? (
              <p className="text-black/60 dark:text-white/60">ما أضفت أي إعلان بعد.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {listings.map((listing: any) => (
                  <li
                    key={listing.id}
                    className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {listing.listing_images?.[0]?.storage_path ? (
                        <div className="w-14 h-14 rounded-lg bg-black/[.03] overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${listing.listing_images[0].storage_path}`}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-black/[.03] shrink-0 flex items-center justify-center text-black/30">
                          🖼️
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{listing.title}</div>
                        <div className="text-sm text-black/60 dark:text-white/60 mt-1 flex flex-wrap gap-x-3">
                          <span>{STATUS_LABELS[listing.status] ?? listing.status}</span>
                          {listing.price != null && <span>· {listing.price} ر.س</span>}
                          {(listing.categories as any)?.name_ar && (
                            <span>· 📂 {(listing.categories as any).name_ar}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-xs text-black/50 dark:text-white/50 hidden sm:block">
                        👁️ {listing.view_count} · 💬 {listing.contact_click_count}
                      </div>
                      <Link
                        href={`/dashboard/listings/${listing.id}/edit`}
                        className="text-sm text-black/60 dark:text-white/60 hover:underline no-print"
                      >
                        تعديل
                      </Link>
                      {listing.status !== "archived" && (
                        <ArchiveButton listingId={listing.id} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="opacity-75">{label}</span>
      <b>{value}</b>
    </div>
  );
}
