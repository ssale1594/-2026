import Link from "next/link";

// Shared by both /admin/* pages — the sellers/listings review queues.
export default function AdminHeader({
  active,
}: {
  active: "sellers" | "listings";
}) {
  return (
    <header className="border-b border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
        <span className="text-lg font-bold">لوحة الإدارة</span>
        <nav className="flex gap-4 text-sm">
          {active === "sellers" ? (
            <span>البائعون</span>
          ) : (
            <Link href="/admin/sellers" className="text-black/60 dark:text-white/60">
              البائعون
            </Link>
          )}
          {active === "listings" ? (
            <span>الإعلانات</span>
          ) : (
            <Link href="/admin/listings" className="text-black/60 dark:text-white/60">
              الإعلانات
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
