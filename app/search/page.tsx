import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import SearchBox from "@/components/search-box";

// TECH.md §8 — dynamic search pages carry no SEO value and must stay out of the index.
export const metadata: Metadata = {
  title: pageTitle("البحث"),
  robots: { index: false, follow: true },
};

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_negotiable: boolean;
  business_name: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let results: SearchResult[] = [];

  if (query) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("search_listings", { p_query: query });
    results = (data as SearchResult[]) ?? [];

    // Feeds the market-pulse reports (migration 22). Stores the query text and
    // hit count only — no visitor identity. A zero-result search here is the
    // single most valuable row in the table: it is unmet local demand.
    await supabase.from("search_log").insert({
      normalized_query: query.toLowerCase(),
      results_count: results.length,
    });
  }

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <SearchBox defaultValue={query} />
        </div>

        {!query ? (
          <p className="text-black/60 dark:text-white/60">
            اكتب كلمة للبحث بين الإعلانات المنشورة.
          </p>
        ) : results.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما لقينا نتائج لـ &quot;{query}&quot;.
          </p>
        ) : (
          <>
            <h1 className="text-lg font-semibold mb-4">
              نتائج البحث عن &quot;{query}&quot;
            </h1>
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((result) => (
                <li key={result.id}>
                  <Link
                    href={`/listing/${result.slug}`}
                    className="block rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                  >
                    <div className="font-medium mb-1">{result.title}</div>
                    {result.price != null && (
                      <div className="text-sm text-black/60 dark:text-white/60">
                        {result.price} ر.س
                        {result.price_negotiable ? " (قابل للتفاوض)" : ""}
                      </div>
                    )}
                    <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                      {result.business_name}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
