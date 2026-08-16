import Link from "next/link";

const TABS = [
  { key: "sellers", href: "/admin/sellers", label: "البائعون" },
  { key: "listings", href: "/admin/listings", label: "الإعلانات" },
  { key: "offers", href: "/admin/offers", label: "العروض" },
  { key: "referrals", href: "/admin/referrals", label: "الترشيحات" },
  { key: "sponsorships", href: "/admin/sponsorships", label: "الرعايات" },
  { key: "pulse", href: "/admin/pulse", label: "نبض الزلفي" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

// Shared by every /admin/* page. Driven by a list rather than repeated
// conditionals — the nav grew from two tabs to five and the branch-per-tab
// version was already unreadable at three.
export default function AdminHeader({ active }: { active: AdminTab }) {
  return (
    <header className="border-b border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-4">
        <span className="text-lg font-bold shrink-0">لوحة الإدارة</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm justify-end">
          {TABS.map((tab) =>
            tab.key === active ? (
              <span key={tab.key}>{tab.label}</span>
            ) : (
              <Link
                key={tab.key}
                href={tab.href}
                className="text-black/60 dark:text-white/60 hover:underline"
              >
                {tab.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
