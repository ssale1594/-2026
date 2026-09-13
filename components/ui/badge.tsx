import type { ReactNode } from "react";

export type BadgeTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLS: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-700 border-brand-500/30",
  success: "bg-success-50 text-success-700 border-success-600/30",
  warning: "bg-warning-50 text-warning-700 border-warning-600/30",
  danger: "bg-danger-50 text-danger-700 border-danger-600/30",
  info: "bg-info-50 text-info-700 border-info-600/30",
  neutral:
    "bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70 border-black/10 dark:border-white/15",
};

// The single place that maps a status word to a color. Every status pill
// across the app (booking status, deal status, moderation state, offer
// state) should route through this instead of hand-picking a Tailwind
// color per page — that's how "confirmed" ended up amber in one place and
// emerald in another.
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-[--radius-pill] border px-2.5 py-1 text-xs font-medium",
        TONE_CLS[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
