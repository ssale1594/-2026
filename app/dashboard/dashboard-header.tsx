import Link from "next/link";
import { siteName } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const SELLER_LINKS = [
  { href: "/dashboard/needs", label: "الطلبات" },
  { href: "/dashboard/offers", label: "عروضي" },
  { href: "/dashboard/bids", label: "🧾 العروض" },
  { href: "/dashboard/deals", label: "الصفقات" },
  { href: "/dashboard/analytics", label: "📊 الإحصائيات" },
  { href: "/dashboard/jobs", label: "وظائفي" },
  { href: "/dashboard/transactions", label: "التعاملات" },
  { href: "/dashboard/referrals", label: "ادعُ جارك" },
  { href: "/dashboard/subscription", label: "الاشتراك" },
  { href: "/dashboard/settings", label: "الإعدادات" },
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
  title,
  subtitle,
  breadcrumb,
}: {
  sellerName?: string;
  backHref?: string;
  backLabel?: string;
  // The newer dashboard pages (analytics, bids) render a titled banner under
  // the nav bar instead of a plain back link. Optional, so the older pages
  // that only pass sellerName are untouched.
  title?: string;
  subtitle?: string;
  breadcrumb?: { label: string; href?: string }[];
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

      {(title || breadcrumb) && (
        <div className="mx-auto max-w-5xl px-4 pb-5">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="text-xs text-black/50 dark:text-white/50 mb-2 flex flex-wrap gap-1">
              {breadcrumb.map((crumb, i) => (
                <span key={i}>
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <b>{crumb.label}</b>
                  )}
                  {i < breadcrumb.length - 1 && <span className="mx-1">/</span>}
                </span>
              ))}
            </nav>
          )}
          {title && <h1 className="text-2xl font-extrabold">{title}</h1>}
          {subtitle && (
            <p className="text-sm text-black/60 dark:text-white/60 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </header>
  );
}
