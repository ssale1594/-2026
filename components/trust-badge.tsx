import type { SellerTrust } from "@/lib/data/trust";

// Neutral styling on purpose — a colourful "verified" chip implies a guarantee
// the platform explicitly does not make (it is a connector, not a broker;
// TECH.md / the terms page). The label states what was actually earned.
const LEVEL_STYLES: Record<number, string> = {
  1: "border-black/[.12] dark:border-white/[.2] text-black/60 dark:text-white/60",
  2: "border-black/[.2] dark:border-white/[.3] text-black/70 dark:text-white/70",
  3: "border-green-600/40 text-green-700 dark:text-green-500",
  4: "border-green-600/70 text-green-700 dark:text-green-500",
};

export default function TrustBadge({
  trust,
  showDetail = false,
}: {
  trust: SellerTrust | null;
  showDetail?: boolean;
}) {
  if (!trust || trust.level === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`rounded-full border px-2 py-0.5 ${LEVEL_STYLES[trust.level] ?? LEVEL_STYLES[1]}`}
      >
        {trust.label}
      </span>

      {trust.identity_verified && (
        <span className="rounded-full border border-black/[.12] dark:border-white/[.2] px-2 py-0.5 text-black/60 dark:text-white/60">
          هوية موثقة
        </span>
      )}

      {showDetail && (
        <span className="text-black/40 dark:text-white/40">
          {trust.vouch_count > 0 && `${trust.vouch_count} توصية جار`}
          {trust.vouch_count > 0 && trust.confirmed_deals > 0 && " · "}
          {trust.confirmed_deals > 0 && `${trust.confirmed_deals} تعامل مؤكد`}
        </span>
      )}
    </div>
  );
}
