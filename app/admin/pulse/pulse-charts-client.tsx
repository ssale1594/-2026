"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

type DemandGap = { query: string; searches: number };
type NeighborhoodActivity = {
  neighborhood_id: number;
  neighborhood_name: string;
  listings_count: number;
  sellers_count: number;
  need_requests_count: number;
};
type HourlyActivity = { weekday: number; hour: number; searches: number };
type TopSearch = { query: string; searches: number };
type DailyActivity = { day: string; searches: number; results_avg: number };
type CategoryVsNeed = {
  category_name: string;
  published_listings: number;
  open_needs: number;
  ratio: number;
};

type Props = {
  daily: DailyActivity[];
  gaps: DemandGap[];
  categoryVsNeed: CategoryVsNeed[];
  neighborhoods: NeighborhoodActivity[];
  hourly: HourlyActivity[];
  top: TopSearch[];
};

const PALETTE = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#22d3ee",
  "#eab308",
];

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function PulseClientCharts({
  daily,
  gaps,
  categoryVsNeed,
  neighborhoods,
  hourly,
  top,
}: Props) {
  const dailyData = useMemo(
    () =>
      daily.map((d) => {
        const date = new Date(d.day);
        return {
          date: `${date.getDate()}/${date.getMonth() + 1}`,
          searches: d.searches,
          avg_results: Number(Number(d.results_avg || 0).toFixed(1)),
        };
      }),
    [daily]
  );

  const gapData = useMemo(
    () => gaps.slice(0, 10).reverse().map((g) => ({ name: g.query, count: g.searches })),
    [gaps]
  );

  const topSearchData = useMemo(
    () => top.slice(0, 10).reverse().map((t) => ({ name: t.query, count: t.searches })),
    [top]
  );

  const catNeedData = useMemo(() => {
    const rows = [...categoryVsNeed]
      .filter((c) => c.published_listings > 0 || c.open_needs > 0)
      .sort((a, b) => b.published_listings + b.open_needs - (a.published_listings + a.open_needs))
      .slice(0, 10);
    return rows.map((r) => ({
      name: r.category_name,
      إعلانات: r.published_listings,
      طلبات: r.open_needs,
    }));
  }, [categoryVsNeed]);

  const pieData = useMemo(
    () =>
      neighborhoods
        .filter((n) => n.listings_count > 0)
        .slice(0, 10)
        .map((n) => ({ name: n.neighborhood_name, value: n.listings_count })),
    [neighborhoods]
  );

  const [heatmapMax, setHeatmapMax] = useState(1);
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const row of hourly) {
      if (row.weekday >= 0 && row.weekday < 7 && row.hour >= 0 && row.hour < 24) {
        grid[row.weekday][row.hour] = Number(row.searches);
      }
    }
    let max = 1;
    for (const w of grid) for (const v of w) if (v > max) max = v;
    setHeatmapMax(max);
    return grid;
  }, [hourly]);

  const total30 = dailyData.reduce((acc, d) => acc + d.searches, 0);

  return (
    <div className="space-y-10">
      {/* Chart 1: Daily activity line chart */}
      <section className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold inline-flex items-center gap-2">
              📈 نشاط البحث خلال 30 يوم
            </h2>
            <p className="text-xs text-black/50 mt-0.5">
              إجمالي عمليات البحث: <strong>{total30.toLocaleString("ar-SA")}</strong> عملية
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/10 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gSearch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ direction: "rtl" }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Area
                type="monotone"
                dataKey="searches"
                name="عمليات البحث"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                fill="url(#gSearch)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Row: Category demand vs supply + Pie neighborhoods */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 card">
          <h2 className="text-lg font-semibold mb-3">📂 العرض مقابل الطلب حسب الفئة</h2>
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/10 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catNeedData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip contentStyle={{ direction: "rtl" }} />
                <Legend wrapperStyle={{ direction: "rtl" }} />
                <Bar dataKey="إعلانات" fill="#10b981" radius={[0, 6, 6, 0]} />
                <Bar dataKey="طلبات" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold mb-3">🏘️ توزيع الإعلانات حسب الأحياء</h2>
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/10 h-80">
            {pieData.length === 0 ? (
              <p className="text-sm text-black/40">لا بيانات.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ direction: "rtl" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {pieData.slice(0, 10).map((d, i) => (
              <li key={d.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                />
                {d.name} ({d.value})
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Row: Top searches bar + Demand gaps bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <h2 className="text-lg font-semibold mb-3">🔥 أكثر الكلمات بحثًا (10)</h2>
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/10 h-80">
            {topSearchData.length === 0 ? (
              <p className="text-sm text-black/40">لا بيانات بعد.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSearchData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ direction: "rtl" }} />
                  <Bar dataKey="count" name="عدد عمليات البحث" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold mb-3 inline-flex items-center gap-2">
            🚨 فجوات الطلب (10)
            <span className="text-xs font-normal text-black/50">بحث بدون نتائج = فرصة تجارية</span>
          </h2>
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/10 h-80">
            {gapData.length === 0 ? (
              <p className="text-sm text-black/40">لا فجوات حالياً — كل شيء متوفر!</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ direction: "rtl" }} />
                  <Bar dataKey="count" name="عدد عمليات البحث" fill="#ef4444" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Heatmap: hourly + weekday activity */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-3 inline-flex items-center gap-2">
          🔥🔥 خريطة حرارية: أوقات نشاط المستخدمين
          <span className="text-xs font-normal text-black/50">(آخر 30 يوم — حسب الساعة واليوم)</span>
        </h2>
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-black/10 overflow-x-auto">
          <table className="text-[10px] font-mono border-collapse w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="p-1 text-right w-20 text-black/50">اليوم / الساعة</th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="p-1 text-center text-black/50 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_NAMES.map((name, d) => (
                <tr key={d}>
                  <td className="p-1 text-right font-semibold border-t border-black/[.05]">{name}</td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const value = heatmap[d]?.[h] ?? 0;
                    const intensity = value === 0 ? 0 : value / heatmapMax;
                    const bg =
                      value === 0
                        ? "rgba(15,23,42,0.03)"
                        : `rgba(14,165,233,${0.12 + intensity * 0.88})`;
                    const color = intensity > 0.5 ? "#fff" : "#0f172a";
                    return (
                      <td
                        key={h}
                        title={`${name} الساعة ${h}:00 — ${value} بحث`}
                        className="p-0.5 border-t border-l border-black/[.04] text-center"
                        style={{ backgroundColor: bg, color, minWidth: 28 }}
                      >
                        {value > 0 ? (
                          <span className="inline-flex w-full h-7 items-center justify-center rounded-sm text-[9px] font-bold">
                            {value}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-black/50">
            أقل
            <span className="w-3 h-3 rounded-sm bg-sky-500/10 inline-block" />
            <span className="w-3 h-3 rounded-sm bg-sky-500/40 inline-block" />
            <span className="w-3 h-3 rounded-sm bg-sky-500/70 inline-block" />
            <span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" />
            أكثر
          </div>
        </div>
      </section>
    </div>
  );
}
