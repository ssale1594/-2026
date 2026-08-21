import type { DailyRow } from "@/app/dashboard/analytics/page";

/**
 * مخططات SVG مُصمَّمة من الصفر بدون أي مكتبات خارجية
 * — التزاماً بمبدأ TECH.md (لا ندفع قبل الدخل، لا تبعيات إضافية).
 */

const AR = { locale: "ar-SA" };
function fmtInt(n: number) {
  return Math.round(n).toLocaleString(AR.locale);
}

export function KpiTile({
  title,
  value,
  sub,
  delta,
  accent,
  icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  delta?: { label: string; positive?: boolean };
  accent?: "sky" | "emerald" | "fuchsia" | "amber" | "indigo" | "rose";
  icon: string;
}) {
  const gradient: Record<NonNullable<typeof accent>, string> = {
    sky:     "from-sky-500/20 via-white to-sky-500/10 dark:from-sky-900/40 dark:via-neutral-900 dark:to-sky-900/20",
    emerald: "from-emerald-500/20 via-white to-emerald-500/10 dark:from-emerald-900/40 dark:via-neutral-900 dark:to-emerald-900/20",
    fuchsia: "from-fuchsia-500/20 via-white to-fuchsia-500/10 dark:from-fuchsia-900/40 dark:via-neutral-900 dark:to-fuchsia-900/20",
    amber:   "from-amber-500/20 via-white to-amber-500/10 dark:from-amber-900/40 dark:via-neutral-900 dark:to-amber-900/20",
    indigo:  "from-indigo-500/20 via-white to-indigo-500/10 dark:from-indigo-900/40 dark:via-neutral-900 dark:to-indigo-900/20",
    rose:    "from-rose-500/20 via-white to-rose-500/10 dark:from-rose-900/40 dark:via-neutral-900 dark:to-rose-900/20",
  };
  return (
    <div
      className={`rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-gradient-to-br ${
        gradient[accent ?? "sky"]
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs opacity-75 font-semibold">{title}</h3>
        <span className="text-2xl" aria-hidden>{icon}</span>
      </div>
      <div className="mt-2 font-extrabold text-2xl tracking-tight">{value}</div>
      {sub && <div className="text-[11px] opacity-65 mt-0.5">{sub}</div>}
      {delta && (
        <div
          className={`text-[11px] mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${
            delta.positive
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200"
          }`}
        >
          {delta.positive ? "▲" : "▼"} {delta.label}
        </div>
      )}
    </div>
  );
}

export function LineChart({
  title,
  subtitle,
  series,
  height = 200,
  accent = "#6366f1",
  tooltipLabel = "مشاهدات",
}: {
  title: string;
  subtitle?: string;
  series: { day: string; value: number }[];
  height?: number;
  accent?: string;
  tooltipLabel?: string;
}) {
  const w = 780;
  const h = height;
  const padX = 40;
  const padY = 24;
  const max = Math.max(1, ...series.map((s) => s.value));
  const min = 0;
  const n = Math.max(1, series.length);

  function x(i: number) {
    return padX + ((w - 2 * padX) * i) / (n - 1 || 1);
  }
  function y(v: number) {
    return h - padY - ((h - 2 * padY) * (v - min)) / (max - min || 1);
  }

  const path = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s.value).toFixed(1)}`)
    .join(" ");

  const area =
    path +
    ` L ${x(n - 1).toFixed(1)} ${h - padY} L ${x(0).toFixed(1)} ${h - padY} Z`;

  // المحور الأفقي: نقاط الشبكة كل ~6 أيام
  const gridLines: number[] = [];
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) gridLines.push(i);

  return (
    <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-neutral-900">
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-extrabold">{title}</h3>
          {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
        </div>
        <div className="inline-flex items-center gap-2 text-xs opacity-80">
          <span
            className="inline-block rounded-full w-3 h-3"
            style={{ background: accent }}
          />
          {tooltipLabel}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        <defs>
          <linearGradient id="lineChartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* خطوط الشبكة الأفقية */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const yy = h - padY - ((h - 2 * padY) * p);
          const labelValue = Math.round(min + (max - min) * p);
          return (
            <g key={i}>
              <line
                x1={padX}
                x2={w - padX}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
              <text
                x={padX - 6}
                y={yy + 3}
                fontSize="10"
                textAnchor="end"
                opacity="0.5"
              >
                {fmtInt(labelValue)}
              </text>
            </g>
          );
        })}

        {/* ملء المنطقة + الخط */}
        <path d={area} fill="url(#lineChartArea)" />
        <path d={path} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* نقاط البيانات + ملصقات المحور */}
        {gridLines.map((i) => {
          const s = series[i];
          if (!s) return null;
          return (
            <g key={i}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={padY}
                y2={h - padY}
                stroke="currentColor"
                strokeOpacity="0.05"
              />
              <circle cx={x(i)} cy={y(s.value)} r="3" fill="white" stroke={accent} strokeWidth="1.5" />
              <text
                x={x(i)}
                y={h - 6}
                fontSize="10"
                textAnchor="middle"
                opacity="0.55"
              >
                {new Date(s.day).toLocaleDateString(AR.locale, {
                  month: "short",
                  day: "numeric",
                })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function FunnelChart({
  title,
  steps,
}: {
  title: string;
  steps: { label: string; value: number; conv?: number }[];
}) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const w = 780;
  const barH = 34;
  const gap = 10;
  const labelW = 200;
  const valueW = 90;
  const barMaxW = w - labelW - valueW - 40;
  const h = steps.length * (barH + gap) + 24;
  const colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];
  return (
    <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-neutral-900">
      <h3 className="text-sm font-extrabold mb-3">{title}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {steps.map((s, i) => {
          const yy = 14 + i * (barH + gap);
          const width = Math.max(12, (s.value / max) * barMaxW);
          const c = colors[i % colors.length];
          return (
            <g key={i}>
              <text x="0" y={yy + barH / 2 + 4} fontSize="12" opacity="0.85">
                {s.label}
              </text>
              <rect
                x={labelW}
                y={yy}
                width={width}
                height={barH}
                rx="10"
                fill={c}
                opacity="0.85"
              />
              <text
                x={labelW + width + 10}
                y={yy + barH / 2 + 4}
                fontSize="12"
                fontWeight="700"
                opacity="0.9"
              >
                {fmtInt(s.value)}
                {typeof s.conv === "number" && !Number.isNaN(s.conv) && (
                  <tspan dx="8" opacity="0.65" fontSize="11">
                    ({s.conv.toFixed(2)}٪)
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function HorizontalBars({
  title,
  subtitle,
  bars,
  accent = "#0ea5e9",
  suffix = "",
}: {
  title: string;
  subtitle?: string;
  bars: { label: string; value: number; pct?: number }[];
  accent?: string;
  suffix?: string;
}) {
  // Hoisted out of the map: the bar widths are all relative to the same peak,
  // so recomputing it per bar was scanning the list once for every row.
  const peak = Math.max(1, ...bars.map((x) => x.value));

  return (
    <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-neutral-900">
      <h3 className="text-sm font-extrabold">{title}</h3>
      {subtitle && <p className="text-xs opacity-60 mb-3 mt-0.5">{subtitle}</p>}
      <div className="space-y-2 mt-3">
        {bars.map((b, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs opacity-80">
              <span className="font-semibold truncate">{b.label}</span>
              <span className="tabular-nums opacity-90">
                {fmtInt(b.value)}
                {suffix}
                {b.pct != null && <span className="opacity-60 mx-1">· {b.pct}٪</span>}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, Math.min(100, b.pct ?? (b.value / peak) * 100))}%`,
                  background: `linear-gradient(90deg, ${accent}, #ffffff22)`,
                  backgroundBlendMode: "overlay",
                  backgroundColor: accent,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupedBarChart({
  title,
  subtitle,
  data,
  series: colors,
}: {
  title: string;
  subtitle?: string;
  data: { day: string; values: (number | null)[] }[];
  series: { name: string; color: string }[];
}) {
  const w = 780;
  const h = 220;
  const padX = 50;
  const padY = 30;
  const groups = data.length;
  const groupW = (w - 2 * padX) / Math.max(1, groups);
  const barW = Math.max(2, (groupW - 12) / Math.max(1, colors.length));
  const max = Math.max(
    1,
    ...data.flatMap((d) => d.values.map((v) => (v == null || Number.isNaN(v) ? 0 : v)))
  );
  function y(v: number) {
    return h - padY - ((h - 2 * padY) * v) / max;
  }
  return (
    <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 bg-white dark:bg-neutral-900">
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-extrabold">{title}</h3>
          {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {colors.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 opacity-85"
            >
              <span
                className="inline-block rounded-full w-3 h-3"
                style={{ background: c.color }}
              />
              {c.name}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {[0, 0.5, 1].map((p, i) => {
          const yy = h - padY - ((h - 2 * padY) * p);
          return (
            <g key={i}>
              <line
                x1={padX}
                x2={w - padX}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
              <text
                x={padX - 6}
                y={yy + 3}
                fontSize="10"
                textAnchor="end"
                opacity="0.5"
              >
                {fmtInt(max * p)}
              </text>
            </g>
          );
        })}

        {data.map((d, gi) => {
          const gx = padX + gi * groupW + 6;
          return (
            <g key={gi}>
              {d.values.map((v, vi) => {
                if (v == null || Number.isNaN(v)) return null;
                const bx = gx + vi * barW;
                const valY = y(v);
                const bh = h - padY - valY;
                return (
                  <rect
                    key={vi}
                    x={bx}
                    y={valY}
                    width={barW - 3}
                    height={Math.max(1, bh)}
                    rx="3"
                    fill={colors[vi % colors.length].color}
                    opacity="0.9"
                  />
                );
              })}
              {/* ملصق كل 5 أيام تقريباً */}
              {gi % Math.max(1, Math.floor(groups / 7)) === 0 && (
                <text
                  x={gx + groupW / 2 - 6}
                  y={h - 8}
                  fontSize="10"
                  opacity="0.55"
                  textAnchor="middle"
                >
                  {new Date(d.day).toLocaleDateString(AR.locale, {
                    month: "short",
                    day: "numeric",
                  })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// TypeScript export usage guard (for lint)
export const _dailySample: DailyRow = {
  bucket_day: "",
  new_listings: 0,
  new_views: 0,
  whatsapp_clicks: 0,
  new_offers_received: 0,
  new_offers_sent: 0,
  new_chats: 0,
  chat_messages_received: 0,
  new_deals: 0,
  deals_completed: 0,
  revenue_sar: 0,
};
