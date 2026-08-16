import Link from "next/link";
import { siteName } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const SELLER_LINKS = [
  { href: "/dashboard/needs", label: "الطلبات" },
  { href: "/dashboard/offers", label: "عروضي" },
  { href: "/dashboard/jobs", label: "وظائفي" },
  { href: "/dashboard/transactions", label: "التعاملات" },
  { href: "/dashboard/referrals", label: "ادعُ جارك" },
  { href: "/dashboard/subscription", label: "الاشتراك" },
];

// Shared by every /dashboard/* page — was copy-pasted 5 times before this
// (setup, listings/new, listings/[id]/edit, subscription, the dashboard index).
// Not a route-group layout.tsx on purpose: /dashboard/setup runs before a
// seller row exists, so it can't call requireSeller() the way the other
// pages do — each page still resolves its own auth/data, this just renders
// the header shell with what that page already has.
export default async function DashboardHeader({
  sellerName,
  backHref,
  backLabel,
}: {
  sellerName?: string;
  backHref?: string;
  backLabel?: string;
}) {
  // Reads its own unread count rather than taking it as a prop, so every page
  // that renders the header gets the badge without threading the value through.
  const supabase = await createClient();
  const { data: unreadCount } = await supabase.rpc("unread_notification_count");

  return (
    <header className="border-b border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold shrink-0">
          {siteName}
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          {backHref && (
            <Link
              href={backHref}
              className="text-sm text-black/60 dark:text-white/60 hover:underline"
            >
              {backLabel ?? "رجوع"}
            </Link>
          )}
          <Link
            href="/notifications"
            className="text-sm text-black/60 dark:text-white/60 hover:underline"
          >
            الإشعارات
            {typeof unreadCount === "number" && unreadCount > 0 && (
              <span className="mr-1 rounded-full bg-foreground text-background text-xs px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </Link>
          {sellerName && (
            <>
              {SELLER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-black/60 dark:text-white/60 hover:underline"
                >
                  {link.label}
                </Link>
              ))}
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
