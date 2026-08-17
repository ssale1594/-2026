import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "@/app/dashboard/dashboard-header";
import {
  KpiTile,
  LineChart,
  FunnelChart,
  HorizontalBars,
  GroupedBarChart,
} from "@/components/analytics-charts";

export type DailyRow = {
  bucket_day: string;
  new_listings: number;
  new_views: number;
  whatsapp_clicks: number;
  new_offers_received: number;
  new_offers_sent: number;
  new_chats: number;
  chat_messages_received: number;
  new_deals: number;
  deals_completed: number;
  revenue_sar: number;
};

const DAYS_OPTIONS = [7, 14, 30, 60];

export default async function SellerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const seller = await requireSeller();
  const supabase = await createClient();
  const sp = await searchParams;
  const days =
    Number(sp.days) && DAYS_OPTIONS.includes(Number(sp.days))
      ? Number(sp.days)
      : 30;

  const [dailyQ, topListingsQ, topNeighQ, funnelQ, kpisQ] = await Promise.all([
    (supabase.rpc as any)("seller_analytics_daily", {
      p_seller_id: seller.id,
      p_days: days,
    }),
    (supabase.rpc as any)("seller_analytics_top_listings", {
      p_seller_id: seller.id,
      p_limit: 5,
    }),
    (supabase.rpc as any)("seller_analytics_top_neighbourhoods", {
      p_seller_id: seller.id,
    }),
    (supabase.rpc as any)("seller_analytics_funnel", {
      p_seller_id: seller.id,
    }),
    (supabase.rpc as any)("seller_dashboard_kpis", { p_seller_id: seller.id }),
  ]);

  const daily = (dailyQ.data as DailyRow[]) ?? [];
  const topListings = (topListingsQ.data as any[]) ?? [];
  const topNeigh = (topNeighQ.data as any[]) ?? [];
  const funnel = (funnelQ.data as any[]) ?? [];
  const kpis = (kpisQ.data as any[])?.[0] ?? {
    views_last7d: 0, views_last30d: 0,
    whatsapp_clicks_last7d: 0, whatsapp_clicks_last30d: 0,
    chat_threads_open: 0, chats_last7d: 0,
    offers_received_last7d: 0, offers_received_last30d: 0,
    bids_last7d: 0, bids_last30d: 0,
    offers_submitted_last7d: 0, offers_submitted_last30d: 0,
    deals_pending: 0, deals_in_progress: 0, deals_completed: 0,
    deals_last7d: 0, deals_last30d: 0,
    revenue_7d_sar: 0, revenue_30d_sar: 0,
    saved_search_matches_last7d: 0, saved_search_matches_last30d: 0,
    new_offers_received_last7d: 0, new_offers_received_last30d: 0,
  };

  // احسب الإحصائيات التراكمية من daily
  const totals = daily.reduce(
    (acc, r) => ({
      views: acc.views + Number(r.new_views || 0),
      wa: acc.wa + Number(r.whatsapp_clicks || 0),
      offers: acc.offers + Number(r.new_offers_received || 0),
      chats: acc.chats + Number(r.new_chats || 0),
      deals: acc.deals + Number(r.new_deals || 0),
      completed: acc.completed + Number(r.deals_completed || 0),
      revenue: acc.revenue + Number(r.revenue_sar || 0),
    }),
    { views: 0, wa: 0, offers: 0, chats: 0, deals: 0, completed: 0, revenue: 0 }
  );

  // نُقّل من اليوم إلى (views + wa click * 3 + offers * 10)
  const seriesViews = daily.map((r) => ({
    day: r.bucket_day,
    value: Number(r.new_views || 0),
  }));
  const seriesEngagement = daily.map((r) => ({
    day: r.bucket_day,
    values: [
      Number(r.whatsapp_clicks || 0),
      Number(r.new_chats || 0),
      Number(r.new_offers_received || 0),
    ],
  }));
  const seriesRevenue = daily.map((r) => ({
    day: r.bucket_day,
    value: Number(r.revenue_sar || 0),
  }));

  function deltaPct(now: number, prev: number) {
    if (!prev) return now > 0 ? { label: "نمو جديد", positive: true } : undefined;
    const pct = Math.round(((now - prev) / prev) * 100);
    if (pct === 0) return { label: "ثابت ٠٪", positive: true };
    return {
      label: `${pct > 0 ? "+" : ""}${pct}٪`,
      positive: pct > 0,
    };
  }

  const periodText = (days === 7 ? "٧ أيام" : days === 14 ? "١٤ يومًا" : days === 30 ? "٣٠ يومًا" : "٦٠ يومًا");

  return (
    <div className="max-w-7xl mx-auto">
      <DashboardHeader
        title="📊 لوحة الإحصائيات للبائع"
        subtitle={`أداؤك خلال آخر ${periodText} في سوق الزلفي — مشاهدات، تفاعل، صفقات، وأهم المناطق`}
        breadcrumb={[
          { label: "الرئيسية", href: "/" },
          { label: "لوحة البائع", href: "/dashboard" },
          { label: "الإحصائيات" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs opacity-70 mr-1">الفترة الزمنية:</span>
        {DAYS_OPTIONS.map((d) => (
          <a
            key={d}
            href={d === days ? "/dashboard/analytics" : `/dashboard/analytics?days=${d}`}
            className={[
              "rounded-full px-3 py-1 text-xs font-bold border",
              d === days
                ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                : "bg-white/60 border-black/10 text-black/70 hover:bg-white dark:bg-white/5 dark:border-white/15 dark:text-white/70",
            ].join(" ")}
          >
            {d} أيام
          </a>
        ))}
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiTile
          title="إجمالي المشاهدات"
          icon="👀"
          accent="sky"
          value={totals.views.toLocaleString("ar-SA")}
          sub={`أعلى من ${Math.max(0, (kpis as any).views_last30d ?? 0)} في الـ KPI العام`}
          delta={deltaPct((kpis as any).views_last7d ?? 0, (kpis as any).views_last30d > 0 ? Math.ceil(((kpis as any).views_last30d) / 4.3) : 0)}
        />
        <KpiTile
          title="نقرات واتساب"
          icon="💬"
          accent="emerald"
          value={totals.wa.toLocaleString("ar-SA")}
          sub={`نقرة لكل ${totals.wa > 0 ? Math.round(totals.views / totals.wa) : "—"} مشاهدة`}
          delta={deltaPct((kpis as any).whatsapp_clicks_last7d ?? 0, (kpis as any).whatsapp_clicks_last30d > 0 ? Math.ceil(((kpis as any).whatsapp_clicks_last30d) / 4.3) : 0)}
        />
        <KpiTile
          title="العروض المالية الواردة"
          icon="💰"
          accent="fuchsia"
          value={totals.offers.toLocaleString("ar-SA")}
          sub="عروض سعر مرسلة عبر زر العرض على الإعلان"
          delta={deltaPct((kpis as any).offers_received_last7d ?? 0, Math.ceil(((kpis as any).offers_received_last30d ?? 0) / 4.3))}
        />
        <KpiTile
          title="إيرادات الصفقات المكتملة"
          icon="💸"
          accent="amber"
          value={`${totals.revenue.toLocaleString("ar-SA")} ر.س`}
          sub={`${totals.completed} صفقة مكتملة خلال الفترة`}
          delta={deltaPct((kpis as any).revenue_7d_sar ?? 0, Math.ceil(((kpis as any).revenue_30d_sar ?? 0) / 4.3))}
        />
      </section>

      {/* المخططات الثلاثة الرئيسية */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <LineChart
          title="مخطط المشاهدات اليومية لإعلاناتك"
          subtitle={`خلال آخر ${days} يوم — يظهر حجم الزيارات على صفحات إعلاناتك`}
          series={seriesViews}
          accent="#0ea5e9"
          tooltipLabel="مشاهدة"
        />
        <GroupedBarChart
          title="التفاعل اليومي: نقرات واتساب / محادثات / عروض مالية"
          subtitle="مقارنة تفصيلية لنقاط التحويل الثلاثة"
          data={seriesEngagement}
          series={[
            { name: "نقرات واتساب", color: "#10b981" },
            { name: "محادثات جديدة", color: "#6366f1" },
            { name: "عروض مالية واردة", color: "#f43f5e" },
          ]}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2">
          <LineChart
            title="منحنى الإيرادات اليومي"
            subtitle="مجموع مبالغ الصفقات التي تم إكمالها في كل يوم"
            series={seriesRevenue}
            height={180}
            accent="#d97706"
            tooltipLabel="إيراد بالريال السعودي"
          />
        </div>
        <HorizontalBars
          title="أهم أحياء الزلفي التي تشاهد إعلاناتك"
          subtitle={`آخر ٣٠ يومًا — ${topNeigh.reduce((s, x) => s + Number(x.total || 0), 0).toLocaleString("ar-SA")} مشاهدة`}
          bars={topNeigh.map((n: any) => ({
            label: n.neighbourhood,
            value: Number(n.total || 0),
            pct: Number(n.pct || 0),
          }))}
          accent="#a855f7"
          suffix=" مشاهدة"
        />
      </section>

      {/* Funnel + Top 5 Listings */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3">
          <FunnelChart
            title="قمع التحويل خلال آخر ٣٠ يومًا"
            steps={(funnel as any[]).map((f: any) => ({
              label: f.step_name,
              value: Number(f.step_value || 0),
              conv: Number(f.conversion_rate_from_previous ?? 0),
            }))}
          />
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-neutral-900">
          <h3 className="text-sm font-extrabold mb-3">🏆 أفضل ٥ إعلانات أداءً</h3>
          <div className="space-y-3">
            {topListings.length === 0 ? (
              <p className="text-xs opacity-60">
                ما فيه إعلانات منشورة كافية لعرض النتائج. انشر إعلانًا أو انتظر
                يومًا لعرض المشاهدات هنا.
              </p>
            ) : (
              topListings.map((l: any, idx: number) => {
                const score =
                  Number(l.views_last30) +
                  Number(l.whatsapp_clicks_last30) * 3 +
                  Number(l.offers_last30) * 10 +
                  Number(l.chat_threads_last30) * 5;
                return (
                  <div key={l.listing_id} className="flex items-start gap-3">
                    <div
                      className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold text-white"
                      style={{
                        background:
                          idx === 0
                            ? "linear-gradient(135deg, #ca8a04, #f59e0b)"
                            : idx === 1
                              ? "linear-gradient(135deg, #64748b, #94a3b8)"
                              : idx === 2
                                ? "linear-gradient(135deg, #9a3412, #fb923c)"
                                : "#475569",
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/listing/${l.slug}`}
                        className="font-bold text-sm line-clamp-1 hover:underline block"
                      >
                        {l.title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-80">
                        <span>
                          👀 {Number(l.views_last30).toLocaleString("ar-SA")}
                        </span>
                        <span>
                          💚 {Number(l.whatsapp_clicks_last30).toLocaleString("ar-SA")}
                        </span>
                        <span>
                          💰 {Number(l.offers_last30)}
                        </span>
                        <span>
                          💬 {Number(l.chat_threads_last30)}
                        </span>
                        {l.neighbourhood && (
                          <span className="opacity-60">📍 {l.neighbourhood}</span>
                        )}
                        <span className="ml-auto tabular-nums opacity-60">
                          نتيجة {score}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-neutral-900 mb-8">
        <h3 className="text-sm font-extrabold mb-2">🧮 كيف نحسب النتائج؟</h3>
        <ul className="text-xs opacity-75 space-y-1.5 leading-relaxed">
          <li>
            • <b>نتيجة الإعلان</b> = (المشاهدات) + (نقرات واتساب × 3) + (العروض المالية × 10) + (المحادثات × 5)
          </li>
          <li>• القمع يوضّح نسبة التحويل من كل مرحلة إلى التي تليها، وليس من المشاهدات مباشرة.</li>
          <li>• جميع البيانات تعود إلى جداول المنصة مباشرة (listing_views / listing_whatsapp_clicks / listing_offers / deals / chat_threads / chat_messages).</li>
          <li>• للاستعلام عن فترات أخرى — استخدم الأزرار بالأعلى (٧ / ١٤ / ٣٠ / ٦٠ يومًا).</li>
        </ul>
      </section>
    </div>
  );
}
