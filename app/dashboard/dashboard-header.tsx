import Link from "next/link";
import { siteName } from "@/lib/seo";

// Shared by every /dashboard/* page — was copy-pasted 5 times before this
// (setup, listings/new, listings/[id]/edit, subscription, the dashboard index).
// Not a route-group layout.tsx on purpose: /dashboard/setup runs before a
// seller row exists, so it can't call requireSeller() the way the other
// pages do — each page still resolves its own auth/data, this just renders
// the header shell with what that page already has.
export default function DashboardHeader({
  sellerName,
  backHref,
  backLabel,
}: {
  sellerName?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="border-b border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          {siteName}
        </Link>
        <div className="flex items-center gap-4">
          {backHref && (
            <Link
              href={backHref}
              className="text-sm text-black/60 dark:text-white/60 hover:underline"
            >
              {backLabel ?? "رجوع"}
            </Link>
          )}
          {sellerName && (
            <>
              <Link
                href="/dashboard/needs"
                className="text-sm text-black/60 dark:text-white/60 hover:underline"
              >
                الطلبات
              </Link>
              <Link
                href="/dashboard/transactions"
                className="text-sm text-black/60 dark:text-white/60 hover:underline"
              >
                التعاملات
              </Link>
              <Link
                href="/dashboard/subscription"
                className="text-sm text-black/60 dark:text-white/60 hover:underline"
              >
                الاشتراك
              </Link>
              <span className="text-sm text-black/60 dark:text-white/60">
                {sellerName}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
