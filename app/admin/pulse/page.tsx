import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import PulseClientCharts from "./pulse-charts-client";
import PrintButton from "@/components/print-button";
import { siteName } from "@/lib/seo";

type TopSearch = { query: string; searches: number; avg_results: number };
type DemandGap = { query: string; searches: number };
type CategoryDemand = {
  category_name: string;
  published_listings: number;
  open_needs: number;
};
type DailyActivity = { day: string; searches: number; results_avg: number };
type NeighborhoodActivity = {
  neighborhood_id: number;
  neighborhood_name: string;
  neighborhood_slug: string;
  listings_count: number;
  sellers_count: number;
  need_requests_count: number;
};
type HourlyActivity = { weekday: number; hour: number; searches: number };
type OverallStat = { label: string; value: number; delta_30_days: number };
type CategoryVsNeed = {
  category_name: string;
  published_listings: number;
  open_needs: number;
  ratio: number;
};

export default async function AdminPulsePage() {
  await requireAdmin();
  const supabase = await createClient();

  const generatedAt = new Date().toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const [
    topSearches,
    demandGaps,
    categoryDemand,
    counts,
    daily,
    neighborhoodAct,
    hourly,
    overall,
    categoryVsNeed,
  ] = await Promise.all([
    supabase.rpc("pulse_top_searches", { p_days: 30, p_limit: 20 }),
    supabase.rpc("pulse_demand_gaps", { p_days: 90, p_limit: 20 }),
    supabase.rpc("pulse_category_demand"),
    supabase.from("search_log").select("id", { count: "exact", head: true }),
    supabase.rpc("pulse_daily_activity", { p_days: 30 }),
    supabase.rpc("pulse_neighborhood_activity", { p_limit: 12 }),
    supabase.rpc("pulse_hourly_activity"),
    supabase.rpc("pulse_overall_stats"),
    supabase.rpc("pulse_category_vs_need"),
  ]);

  const top = (topSearches.data as TopSearch[]) ?? [];
  const gaps = (demandGaps.data as DemandGap[]) ?? [];
  const byCategory = (categoryDemand.data as CategoryDemand[]) ?? [];
  const dailyRows = (daily.data as DailyActivity[]) ?? [];
  const neighborhoodRows = (neighborhoodAct.data as NeighborhoodActivity[]) ?? [];
  const hourlyRows = (hourly.data as HourlyActivity[]) ?? [];
  const statsRows = (overall.data as OverallStat[]) ?? [];
  const catNeedRows = (categoryVsNeed.data as CategoryVsNeed[]) ?? [];

  const serialized = {
    siteName: siteName,
    generatedAt,
    searchLogTotal: counts.count ?? 0,
    top,
    gaps,
    byCategory,
    daily: dailyRows.map((d) => ({ ...d, day: new Date(d.day).toISOString() })),
    neighborhoods: neighborhoodRows,
    hourly: hourlyRows,
    stats: statsRows,
    categoryVsNeed: catNeedRows,
  };

  return (
    <>

      <div className="min-h-screen font-sans">
        <AdminHeader active="pulse" />

        <main className="mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">📊 نبض الزلفي</h1>
              <p className="text-sm text-black/60 dark:text-white/60 max-w-2xl leading-relaxed">
                تقرير بياني شامل لحركة المنصة. البيانات مجمّعة بالكامل — ما نخزن أي معلومة تعود على شخص معين.
                <span className="text-xs block mt-1 opacity-80">توليد التقرير: {generatedAt}</span>
              </p>
            </div>
            <div className="no-print flex flex-wrap items-center gap-2">
              <PrintButton className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                تصدير PDF (طباعة)
              </PrintButton>
            </div>
          </div>

          {/* KPI Cards */}
          <section className="mb-8 card">
            <h2 className="text-lg font-semibold mb-3">📈 الأرقام العامة</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {statsRows.map((s) => (
                <KpiCard
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  delta={s.delta_30_days}
                />
              ))}
            </div>
          </section>

          <PulseClientCharts
            daily={serialized.daily}
            gaps={serialized.gaps}
            categoryVsNeed={serialized.categoryVsNeed}
            neighborhoods={serialized.neighborhoods}
            hourly={serialized.hourly}
            top={serialized.top}
          />

          <div className="print-break"></div>

          {/* Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10 card">
            <section>
              <h2 className="font-semibold mb-3 text-lg inline-flex items-center gap-2">
                🔴 ماذا ينقص الزلفي؟
                <span className="text-xs font-normal text-black/50">(آخر 90 يوم)</span>
              </h2>
              <p className="text-xs text-black/50 dark:text-white/50 mb-3">
                بحث عنها الناس وما لقوا ولا نتيجة — فرص تجارية ناقصة بالبلد.
              </p>
              {gaps.length === 0 ? (
                <p className="text-sm text-black/40 dark:text-white/40">لا يوجد.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {gaps.slice(0, 15).map((gap, i) => (
                    <li
                      key={gap.query}
                      className="flex items-center justify-between rounded-xl border border-black/[.08] dark:border-white/[.145] px-3 py-2 text-sm bg-white dark:bg-black/20"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs font-bold rounded-md bg-red-500/15 text-red-700 dark:text-red-300 w-6 text-center py-0.5">
                          #{i + 1}
                        </span>
                        {gap.query}
                      </span>
                      <span className="text-black/50 dark:text-white/50 text-xs">
                        {gap.searches} بحث
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-semibold mb-3 text-lg inline-flex items-center gap-2">
                🔥 أكثر ما يُبحث عنه
                <span className="text-xs font-normal text-black/50">(آخر 30 يوم)</span>
              </h2>
              {top.length === 0 ? (
                <p className="text-sm text-black/40 dark:text-white/40">لا يوجد بعد.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {top.slice(0, 15).map((row) => (
                    <li
                      key={row.query}
                      className="flex items-center justify-between rounded-xl border border-black/[.08] dark:border-white/[.145] px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{row.query}</span>
                      <span className="text-black/50 dark:text-white/50 text-xs">
                        {row.searches} بحث · {row.avg_results} نتيجة
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <footer className="mt-16 pt-6 border-t border-black/[.08] dark:border-white/[.145] text-center text-xs text-black/40">
            تقرير «نبض الزلفي» — تم توليده بتاريخ {generatedAt}
            <br />
            © {new Date().getFullYear()} {siteName}
          </footer>
        </main>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: number;
}) {
  const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-black/40";
  const deltaSign = delta > 0 ? "+" : "";
  return (
    <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/20">
      <div className="text-xs text-black/50 dark:text-white/50 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString("ar-SA")}</div>
      <div className={`text-xs mt-1 font-semibold ${deltaColor}`}>
        {deltaSign}
        {delta.toLocaleString("ar-SA")} آخر 30 يوم
      </div>
    </div>
  );
}
