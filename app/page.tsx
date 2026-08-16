import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { siteName } from "@/lib/seo";
import SearchBox from "@/components/search-box";
import NeighborhoodSelect from "@/components/neighborhood-select";
import SponsorBanner from "@/components/sponsor-banner";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import { getJourneys } from "@/lib/data/journeys";
import { getSponsorship } from "@/lib/data/sponsorships";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: categories }, neighborhoods, journeys, sponsorship] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name_ar, slug")
        .eq("is_active", true)
        .order("sort_order"),
      getNeighborhoods(),
      getJourneys(),
      getSponsorship("home"),
    ]);

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-4">
          <span className="text-lg font-bold shrink-0">{siteName}</span>
          <nav className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm text-black/60 dark:text-white/60">
            <Link href="/needs" className="hover:underline">
              الطلبات
            </Link>
            <Link href="/whats-new" className="hover:underline">
              وش الجديد؟
            </Link>
            <Link href="/refer-a-business" className="hover:underline">
              رشّح مشروعًا
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-black/60 dark:text-white/60 mb-8">
          دليل محلات، أسر منتجة، خدمات، عقار، ومستعمل بالزلفي
        </p>

        <SponsorBanner sponsorship={sponsorship} />

        <div className="mb-6">
          <SearchBox />
        </div>

        <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-4 mb-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm">ما لقيت اللي تبيه؟</div>
            <p className="text-sm text-black/60 dark:text-white/60">
              انشر طلبك وخلّ البائعين يتواصلون معك.
            </p>
          </div>
          <Link
            href="/needs/new"
            className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 shrink-0"
          >
            أحتاج...
          </Link>
        </div>

        {neighborhoods.length > 0 && (
          <div className="mb-10">
            <NeighborhoodSelect neighborhoods={neighborhoods} />
          </div>
        )}

        <h1 className="text-xl font-semibold mb-6">تصفح حسب الفئة</h1>

        {!categories || categories.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه فئات بعد — تأكد إن قاعدة البيانات متصلة وseed.sql مطبّق.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="block rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-6 text-center hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                >
                  {category.name_ar}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {journeys.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold mb-1">تجهّز لمناسبتك</h2>
            <p className="text-sm text-black/60 dark:text-white/60 mb-6">
              كل اللي تحتاجه لكل مناسبة بمكان واحد.
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {journeys.map((journey) => (
                <li key={journey.id}>
                  <Link
                    href={`/journey/${journey.slug}`}
                    className="block rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-6 text-center hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                  >
                    {journey.name_ar}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-black/[.08] dark:border-white/[.145] mt-10">
        <div className="mx-auto max-w-5xl px-4 py-6 flex flex-wrap gap-4 text-xs text-black/40 dark:text-white/40">
          <Link href="/privacy" className="hover:underline">
            سياسة الخصوصية
          </Link>
          <Link href="/terms" className="hover:underline">
            الشروط والأحكام
          </Link>
          <Link href="/refund" className="hover:underline">
            سياسة الاسترجاع
          </Link>
        </div>
      </footer>
    </div>
  );
}
