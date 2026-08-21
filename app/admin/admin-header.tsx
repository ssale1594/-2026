import Link from "next/link";
import NavMenu, { type NavLink } from "@/components/nav-menu";

const TABS = [
  { key: "sellers", href: "/admin/sellers", label: "البائعون" },
  { key: "ambassadors", href: "/admin/ambassadors", label: "سفراء الأحياء" },
  { key: "listings", href: "/admin/listings", label: "الإعلانات" },
  { key: "offers", href: "/admin/offers", label: "العروض" },
  { key: "jobs", href: "/admin/jobs", label: "الوظائف" },
  { key: "events", href: "/admin/events", label: "الفعاليات" },
  { key: "referrals", href: "/admin/referrals", label: "الترشيحات" },
  { key: "sponsorships", href: "/admin/sponsorships", label: "الرعايات" },
  { key: "pulse", href: "/admin/pulse", label: "نبض الزلفي" },
  { key: "email", href: "/admin/email", label: "البريد" },
  { key: "polls", href: "/admin/polls", label: "الاستفتاءات" },
  { key: "moderation", href: "/admin/moderation", label: "التدقيق" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

// Shared by every /admin/* page. Driven by a list rather than repeated
// conditionals — the nav grew from two tabs to eleven and the branch-per-tab
// version was already unreadable at three. Below `md` the eleven tabs collapse
// into a hamburger (components/nav-menu.tsx); they used to wrap into four rows.
export default function AdminHeader({ active }: { active: AdminTab }) {
  const links: NavLink[] = TABS.map((tab) => ({
    href: tab.href,
    label: tab.label,
    current: tab.key === active,
  }));

  return (
    <header className="relative border-b border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold shrink-0">
          لوحة الإدارة
        </Link>
        <NavMenu links={links} label="قائمة الإدارة" />
      </div>
    </header>
  );
}
