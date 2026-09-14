"use client";

import Link from "next/link";
import { useState } from "react";

const LINKS = [
  { href: "/map", label: "🗺️ دليل الزلفي" },
  { href: "/search", label: "🔎 البحث المتقدم" },
  { href: "/offers", label: "💸 عروض اليوم" },
  { href: "/needs", label: "🙋 احتياجات الجيران" },
  { href: "/ambassadors", label: "🙌 سفراء الأحياء" },
  { href: "/polls", label: "🗳️ الاستفتاء الأسبوعي" },
  { href: "/jobs", label: "💼 وظائف" },
  { href: "/events", label: "🎪 فعاليات" },
];

// The 7-link nav used to just flex-wrap, which broke into 3 cramped rows on
// phone widths with no way to collapse it. Below `md` it's now a hamburger
// menu instead; `md` and up keeps the original horizontal row.
//
// isLoggedIn is optional (defaults to "logged out") because most pages using
// this nav don't fetch auth state — a logged-in visitor there just sees a
// harmless "دخول" link that re-sends a login email. Pages that already know
// the auth state (e.g. /map) should pass it through for the accurate label.
export default function SiteNav({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [open, setOpen] = useState(false);

  const accountLink = isLoggedIn
    ? { href: "/dashboard", label: "📋 لوحة التحكم" }
    : { href: "/login", label: "🔑 تسجيل الدخول" };

  return (
    <>
      <nav className="hidden md:flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm text-black/65 dark:text-white/70">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:underline">
            {link.label}
          </Link>
        ))}
        <Link
          href="/my/favorites"
          className="hover:underline font-semibold text-rose-600"
        >
          ❤️ المفضلة
        </Link>
        <Link
          href={accountLink.href}
          className="hover:underline font-semibold text-brand-700 dark:text-brand-500"
        >
          {accountLink.label}
        </Link>
      </nav>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="القائمة"
        aria-expanded={open}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-black/[.12] dark:border-white/[.2] shrink-0"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <nav className="md:hidden absolute inset-x-0 top-full bg-white dark:bg-black border-b border-black/[.08] dark:border-white/[.145] shadow-lg flex flex-col p-3 gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/my/favorites"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 font-semibold text-rose-600 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            ❤️ المفضلة
          </Link>
          <Link
            href={accountLink.href}
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 font-semibold text-brand-700 dark:text-brand-500 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            {accountLink.label}
          </Link>
        </nav>
      )}
    </>
  );
}
