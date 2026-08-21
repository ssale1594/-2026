import type { Sponsorship } from "@/lib/data/sponsorships";

// Rendered as a labelled strip, never as a lookalike listing — PLAN.md §18.4
// framed sponsorship as community support rather than an intrusive ad, and an
// unlabelled banner that reads like content would undercut exactly that.
export default function SponsorBanner({
  sponsorship,
}: {
  sponsorship: Sponsorship | null;
}) {
  if (!sponsorship) return null;

  const label = (
    <>
      <span className="text-xs text-black/40 dark:text-white/40">
        برعاية
      </span>{" "}
      <span className="font-medium">{sponsorship.sponsor_name}</span>
      {sponsorship.message && (
        <span className="text-black/60 dark:text-white/60">
          {" "}
          — {sponsorship.message}
        </span>
      )}
    </>
  );

  return (
    <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] bg-black/[.02] dark:bg-white/[.04] px-4 py-3 text-sm mb-6">
      {sponsorship.sponsor_url ? (
        <a
          href={sponsorship.sponsor_url}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="hover:underline"
        >
          {label}
        </a>
      ) : (
        label
      )}
    </div>
  );
}
