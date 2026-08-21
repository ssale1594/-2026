type Tier = "free" | "silver" | "gold" | "diamond";

export function tierBadge(tier: Tier | "free" | undefined) {
  const t: Tier = (tier as any) ?? "free";
  switch (t) {
    case "diamond":
      return {
        text: "💎 عضو الماس",
        cls: "bg-gradient-to-br from-sky-100 via-white to-fuchsia-100 dark:from-sky-950/50 dark:via-neutral-900 dark:to-fuchsia-950/50 border-sky-500/30 text-sky-800 dark:text-sky-200 shadow shadow-sky-500/20",
      };
    case "gold":
      return {
        text: "🥇 عضو ذهبي",
        cls: "bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-amber-950/50 dark:via-neutral-900 dark:to-amber-950/50 border-amber-500/40 text-amber-800 dark:text-amber-200 shadow shadow-amber-500/20",
      };
    case "silver":
      return {
        text: "🥈 عضو فضي",
        cls: "bg-gradient-to-br from-neutral-100 via-white to-neutral-100 dark:from-neutral-800/60 dark:via-neutral-900 dark:to-neutral-800/60 border-neutral-400/30 text-neutral-700 dark:text-neutral-200",
      };
    default:
      return {
        text: null,
        cls: "",
      };
  }
}

export default function PremiumBadge({
  tier,
  className = "",
  compact = false,
}: {
  tier: Tier | undefined | null;
  className?: string;
  compact?: boolean;
}) {
  const badge = tierBadge((tier as any) ?? "free");
  if (!badge.text) return null;
  return (
    <span
      className={[
        compact
          ? "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold"
          : "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
        badge.cls,
        className,
      ].join(" ")}
    >
      {badge.text}
    </span>
  );
}
