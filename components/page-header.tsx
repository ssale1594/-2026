import Link from "next/link";

// Title/subtitle/breadcrumb banner for the public /my/* pages. The /dashboard/*
// equivalent lives inside DashboardHeader instead, because those pages also
// need the seller nav bar above it — this one is the banner on its own.
export default function PageHeader({
  title,
  subtitle,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <header className="px-4 py-6">
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
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {subtitle && (
        <p className="text-sm text-black/60 dark:text-white/60 mt-1 max-w-3xl">
          {subtitle}
        </p>
      )}
    </header>
  );
}
