import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName, siteUrl } from "@/lib/seo";
import SearchBox from "@/components/search-box";
import SaveSearchButton from "./save-search-button";
import SearchFilters from "./search-filters";
import SortSelect from "./sort-select";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import { listingImageUrl } from "@/lib/storage";
import Image from "next/image";

export const metadata: Metadata = {
  title: pageTitle("البحث المتقدم"),
  robots: { index: false, follow: true },
};

export type SearchSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "views_desc"
  | "contact_desc";

// SearchParamsObj is the raw URL shape (everything a string); FilterState is
// the same filters after parsing, which is what the page actually passes down.
export type FilterState = {
  q: string;
  min: number | null;
  max: number | null;
  n: string | null;
  c: string | null;
  sort: SearchSort;
  ng: boolean;
  img: boolean;
  t: number;
  r: number | null;
};

export type SearchParamsObj = {
  q?: string;
  min?: string;
  max?: string;
  n?: string; // neighborhood slug
  c?: string; // category slug
  sort?: SearchSort;
  ng?: string; // negotiable only (1/0)
  img?: string; // with images only (1/0)
  t?: string; // min trust level
  r?: string; // min rating
};

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_negotiable: boolean;
  description: string | null;
  has_images: boolean;
  thumbnail_path: string | null;
  view_count: number;
  contact_click_count: number;
  average_rating: number | null;
  trust_level: number;
  seller_id: string;
  business_name: string;
  seller_slug: string;
  neighborhood_slug: string | null;
  neighborhood_name: string | null;
  category_slug: string | null;
  category_name: string | null;
  published_at: string;
};

type TrendingSearch = { query: string; count: number; avg_results: number };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsObj>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const min = sp.min ? parseFloat(sp.min) : null;
  const max = sp.max ? parseFloat(sp.max) : null;
  const neighborhood = sp.n || null;
  const category = sp.c || null;
  const SORTS: SearchSort[] = [
    "newest",
    "oldest",
    "price_asc",
    "price_desc",
    "rating_desc",
    "views_desc",
    "contact_desc",
  ];
  const sort: SearchSort = SORTS.find((s) => s === sp.sort) ?? "newest";
  const negotiableOnly = sp.ng === "1";
  const withImagesOnly = sp.img === "1";
  const minTrust = sp.t ? parseInt(sp.t, 10) : 0;
  const minRating = sp.r ? parseFloat(sp.r) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let results: SearchResult[] = [];

  if (q || neighborhood || category || min || max || negotiableOnly || withImagesOnly || minTrust || minRating) {
    const { data } = await supabase.rpc("search_listings_advanced", {
      p_query: q,
      p_price_min: !isNaN(min as any) && min !== null ? min : null,
      p_price_max: !isNaN(max as any) && max !== null ? max : null,
      p_neighborhood_slug: neighborhood,
      p_category_slug: category,
      p_negotiable_only: negotiableOnly,
      p_with_images_only: withImagesOnly,
      p_min_trust_level: isNaN(minTrust) ? 0 : minTrust,
      p_min_rating: !isNaN(minRating as any) && minRating !== null ? minRating : null,
      p_sort: sort,
      p_limit: 80,
      p_offset: 0,
    });
    results = (data as SearchResult[]) ?? [];

    if (q) {
      await supabase.from("search_log").insert({
        normalized_query: q.toLowerCase(),
        results_count: results.length,
      });
    }
  }

  const [neighborhoods, { data: popularCats }, { data: trending }] = await Promise.all([
    getNeighborhoods(),
    supabase.rpc("get_popular_categories", { p_limit: 12 }),
    supabase.rpc("get_trending_searches", { p_limit: 10 }),
  ]);

  const trendingSearches = (trending as TrendingSearch[] | null) ?? [];

  const filterState = {
    q,
    min,
    max,
    n: neighborhood,
    c: category,
    sort,
    ng: negotiableOnly,
    img: withImagesOnly,
    t: minTrust,
    r: minRating,
  };

  const anyFilter = Boolean(
    neighborhood || category || min != null || max != null || negotiableOnly || withImagesOnly || minTrust || (minRating != null)
  );

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-7xl px-4 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold shrink-0">
            {siteName}
          </Link>
          <nav className="text-sm text-black/60 dark:text-white/60 flex gap-4 items-center flex-wrap justify-end">
            <Link href="/" className="hover:underline">الرئيسية</Link>
            <Link href="/needs" className="hover:underline">أحتاج</Link>
            {user && <Link href="/notifications" className="hover:underline">الإشعارات</Link>}
            {user && <Link href="/dashboard" className="hover:underline font-medium">لوحة البائع</Link>}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Hero search */}
        <div className="mb-8 rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-gradient-to-br from-sky-50 to-white dark:from-sky-900/20 dark:to-black/20 p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">ابحث عن كل ما تحتاجه في الزلفي</h1>
          <p className="text-sm sm:text-base text-black/60 dark:text-white/60 mb-6">
            من منتجات الأسر المنتجة إلى خدمات المحلات. استخدم الفلاتر اللي يناسبك وابحث بالصوت براحة.
          </p>
          <SearchBox defaultValue={q} size="lg" />
          {trendingSearches.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-black/50 dark:text-white/50 shrink-0">🔥 البحثات الشائعة:</span>
              {trendingSearches.slice(0, 6).map((t) => (
                <Link
                  key={t.query}
                  href={`/search?q=${encodeURIComponent(t.query)}`}
                  className="rounded-full bg-white dark:bg-black/40 border border-black/[.08] dark:border-white/[.145] px-3 py-1 text-xs hover:bg-sky-50 dark:hover:bg-sky-900/30 transition"
                >
                  {t.query}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar filters */}
          <aside className="lg:sticky lg:top-4 self-start">
            <SearchFilters
              neighborhoods={neighborhoods}
              popularCategories={(popularCats as any[]) || []}
              state={filterState}
            />
          </aside>

          {/* Results */}
          <section>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-medium">
                  {q ? (
                    <>نتائج البحث عن <span className="font-bold text-sky-700">«{q}»</span></>
                  ) : (
                    <>عرض كل الإعلانات المفلترة</>
                  )}
                  <span className="ml-1 text-black/50 dark:text-white/50">
                    ({results.length} نتيجة)
                  </span>
                </div>
                {anyFilter && (
                  <div className="mt-1 text-xs">
                    <Link
                      href="/search"
                      className="text-red-600 hover:underline inline-flex items-center gap-1"
                    >
                      ✕ مسح كل الفلاتر
                    </Link>
                  </div>
                )}
              </div>
              <SortSelect current={sort} hasQuery={Boolean(q)} state={filterState} />
            </div>

            {(!q && !anyFilter) ? (
              <EmptyNoQuery />
            ) : results.length === 0 ? (
              <EmptyResults q={q} user={user} state={filterState} />
            ) : (
              <>
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {results.map((r) => (
                    <ResultCard key={r.id} r={r} />
                  ))}
                </ul>

                <div className="mt-8">
                  <SaveSearchButton
                    query={q}
                    isSignedIn={Boolean(user)}
                    resultsCount={results.length}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyNoQuery() {
  return (
    <div className="rounded-xl border border-dashed border-black/15 dark:border-white/20 p-10 text-center">
      <div className="text-5xl mb-3">🔎</div>
      <h2 className="font-semibold mb-1">ابدأ بكتابة ما تريد البحث عنه</h2>
      <p className="text-sm text-black/60 dark:text-white/60 max-w-md mx-auto">
        جرب كلمات مثل: حلويات، كهربائي، ثلاجة مستعملة، تكييف، تمور، خياطة. أو استخدم زر الميكروفون للبحث الصوتي.
      </p>
    </div>
  );
}

function EmptyResults({
  q,
  user,
  state,
}: {
  q: string;
  user: { id: string } | null;
  state: FilterState;
}) {
  const currentFilter = new URLSearchParams();
  if (state.q) currentFilter.set("q", state.q);

  return (
    <div className="rounded-xl border border-dashed border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 p-8 text-center">
      <div className="text-5xl mb-3">🤔</div>
      <h2 className="font-semibold mb-2 text-lg">
        {q ? <>ما لقينا نتائج لـ «{q}»</> : <>لا توجد نتائج مع هذه الفلاتر</>}
      </h2>
      <p className="text-sm text-black/60 dark:text-white/60 max-w-lg mx-auto mb-5">
        جرب كلمة أبسط، أو أزل بعض الفلاتر. لو حاب نتعرف بالظبط على اللي تحتاجه — انشر طلبك في زر «أحتاج» والباعة يتواصلون معك مباشرة.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <SaveSearchButton query={q} isSignedIn={Boolean(user)} resultsCount={0} />
        <Link
          href="/needs/new"
          className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-4 py-2 inline-flex items-center gap-2"
        >
          📝 انشر طلبك في أحتاج
        </Link>
        {!!(state.n || state.c || state.min || state.max || state.ng || state.img || state.t || state.r) && (
          <Link
            href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
            className="rounded-lg border border-black/15 dark:border-white/20 px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5"
          >
            ✕ أزل الفلاتر
          </Link>
        )}
      </div>
    </div>
  );
}

function ResultCard({ r }: { r: SearchResult }) {
  return (
    <li>
      <Link
        href={`/listing/${r.slug}`}
        className="group block h-full rounded-xl border border-black/[.08] dark:border-white/[.145] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition bg-white dark:bg-black/10"
      >
        <div className="aspect-[16/10] bg-black/[.04] dark:bg-white/[.06] relative overflow-hidden">
          {r.thumbnail_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listingImageUrl(r.thumbnail_path)}
              alt={r.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-black/20 dark:text-white/20">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          )}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {r.trust_level >= 3 && (
              <span className="rounded-full bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-bold shadow">
                موثوق ⭐
              </span>
            )}
            {r.price_negotiable && (
              <span className="rounded-full bg-amber-500/90 text-white text-[10px] px-2 py-0.5 font-semibold shadow">
                قابل للتفاوض
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-sky-700 transition-colors">
              {r.title}
            </h3>
            {r.average_rating != null && r.average_rating > 0 && (
              <div className="shrink-0 text-xs inline-flex items-center gap-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                ★ {r.average_rating.toFixed(1)}
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-1 mb-2">
            {r.price != null ? (
              <span className="font-bold text-lg text-sky-700">{r.price} ر.س</span>
            ) : (
              <span className="text-sm text-black/50 dark:text-white/50 italic">السعر عند التواصل</span>
            )}
          </div>

          {r.description && (
            <p className="text-xs text-black/55 dark:text-white/55 line-clamp-2 mb-3 leading-relaxed">
              {r.description}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-black/50 dark:text-white/50 pt-3 border-t border-black/[.06] dark:border-white/[.1]">
            <Link
              href={`/seller/${r.seller_slug}`}
              className="truncate hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              🏪 {r.business_name}
            </Link>
            <span className="shrink-0">
              👁 {r.view_count}
            </span>
          </div>

          {(r.neighborhood_name || r.category_name) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {r.neighborhood_name && (
                <span className="rounded-md bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 text-[10px] px-1.5 py-0.5 font-medium">
                  📍 {r.neighborhood_name}
                </span>
              )}
              {r.category_name && (
                <span className="rounded-md bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 text-[10px] px-1.5 py-0.5 font-medium">
                  {r.category_name}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

