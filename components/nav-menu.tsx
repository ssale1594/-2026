"use client";

import Link from "next/link";
import { useState } from "react";

export type NavLink = {
  href: string;
  label: string;
  /** Rendered as a small pill after the label — used for the unread count. */
  badge?: number;
  /** Current page: shown as plain text instead of a link. */
  current?: boolean;
  emphasis?: boolean;
};

// Shared responsive nav for the dashboard and admin headers, which carry 11 and
// 10 links respectively. Both used to be a plain `flex flex-wrap`, which on a
// phone collapsed into four cramped rows of link text with no way to dismiss it
// — the same problem the public header had before components/site-nav.tsx.
//
// Kept separate from SiteNav rather than merged into it: SiteNav hardcodes the
// public link list and its ❤️ favourites treatment, while these two need links
// passed in plus a trailing slot (the seller's name / the notification badge).
export default function NavMenu({
  links,
  trailing,
  label = "القائمة",
}: {
  links: NavLink[];
  trailing?: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const item = (link: NavLink, onNavigate?: () => void, block = false) => {
    const base = block
      ? "rounded-lg px-3 py-2 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
      : "hover:underline";
    const tone = link.emphasis
      ? "font-semibold"
      : "text-black/60 dark:text-white/60";

    if (link.current) {
      return (
        <span key={link.href} className={`${base} font-semibold`}>
          {link.label}
        </span>
      );
    }

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        className={`${base} ${tone}`}
      >
        {link.label}
        {typeof link.badge === "number" && link.badge > 0 && (
          <span className="mr-1 rounded-full bg-foreground text-background text-xs px-1.5 py-0.5">
            {link.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <div className="hidden md:flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
        {links.map((link) => item(link))}
        {trailing}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-black/[.12] dark:border-white/[.2] shrink-0"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <nav className="md:hidden absolute inset-x-0 top-full z-40 bg-white dark:bg-black border-b border-black/[.08] dark:border-white/[.145] shadow-lg flex flex-col p-3 gap-1 text-sm">
          {links.map((link) => item(link, () => setOpen(false), true))}
          {trailing && (
            <div className="px-3 pt-2 mt-1 border-t border-black/[.06] dark:border-white/[.08] text-black/60 dark:text-white/60">
              {trailing}
            </div>
          )}
        </nav>
      )}
    </>
  );
}
