import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import DeleteSavedSearch from "./delete-saved-search";
import { deleteSavedSearch, runMatcherOnce } from "./saved-searches-actions";
import ListingCard from "@/components/listing-card";

export const metadata: Metadata = {
  title: pageTitle("بحوثاتي المحفوظة"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: searches }, { data: notifications }, unreadQ] = await Promise.all([
    supabase
      .from("saved_searches")
      .select(
        "id, query, created_at, category_id, neighborhood_id, " +
          "categories(name_ar), neighborhoods(name_ar)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<any[]>(),
    supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("user_id", user.id)
      .eq("type", "saved_search_match")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("type", "saved_search_match")
      .eq("is_read", false),
  ]);

  // لقائمة التنبيهات: اربطها بالإعلانات المقابلة (من الـ link slug)
  const notifList: any[] = (notifications as any[]) ?? [];
  const listingSlugs: string[] = [];
  for (const n of notifList) {
    const slug = (n.link || "").replace(/^\/listing\//, "").replace(/\/.*/, "");
    if (slug) listingSlugs.push(slug);
  }
  let listingsBySlug = new Map<string, any>();
  if (listingSlugs.length > 0) {
    const q = await supabase
      .from("listings")
      .select(
        "id, title, slug, status, price, price_negotiable, view_count, contact_click_count, created_at, " +
          "categories(name_ar), neighborhoods(name_ar, slug), sellers(business_name, slug, verification_status), " +
          "listing_images(storage_path, is_primary)"
      )
      .in("slug", Array.from(new Set(listingSlugs)).slice(0, 100));
    for (const l of (q.data as any[]) ?? []) listingsBySlug.set(l.slug, l);
  }

  const unreadCount = (unreadQ as any).count ?? 0;

  return (
    <div className="min-h-screen font-sans bg-white dark:bg-neutral-950 text-black dark:text-white">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between gap-3 flex-wrap">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <nav className="text-sm text-black/60 dark:text-white/60 flex items-center gap-3 flex-wrap">
            <Link href="/search" className="hover:underline">صفحة البحث</Link>
            <Link href="/my/deals" className="hover:underline">صفقاتي</Link>
            <Link href="/my/offers" className="hover:underline">💰 عروضي المالية</Link>
            <Link href="/my/inbox" className="hover:underline">📨 الرسائل</Link>
            <form
              action={async () => {
                "use server";
                await runMatcherOnce();
              }}
              className="inline"
            >
              <button
                type="submit"
                className="rounded-full border border-black/[.12] dark:border-white/[.2] text-xs font-semibold px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10"
              >
                ⏱ تشغيل مطابقة الإشعارات الآن
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <nav className="text-xs text-black/50 dark:text-white/50 mb-3">
            <Link href="/" className="hover:underline">الرئيسية</Link> /{" "}
            <b>بحوثاتي المحفوظة</b>
          </nav>
          <h1 className="text-3xl font-extrabold inline-flex items-center gap-3">
            🔎 بحوثاتي المحفوظة
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-2 max-w-2xl">
            كل مرة ينشر أحد إعلاناً جديداً يطابق بحثك — يظهر لك إشعار مباشر في
            الأعلى هنا، بالإضافة لنقطة تنبيه في قائمة الإشعارات الرئيسية.
          </p>
          {unreadCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-white to-indigo-500/10 dark:from-indigo-950/30 dark:via-neutral-900 dark:to-indigo-950/30 border border-indigo-500/30 px-4 py-2 shadow-sm">
              <span className="rounded-full bg-indigo-600 text-white text-xs font-bold w-6 h-6 grid place-items-center">
                {unreadCount}
              </span>
              <span className="text-sm font-semibold">
                إعلانات جديدة وصلت تطابق بحوثاتك — تدقق فيها قبل أن تأخذها أسرع الباعة!
              </span>
            </div>
          )}
        </header>

        {/* Alerts Section */}
        <section className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl font-extrabold inline-flex items-center gap-2">
                🔔 التنبيهات الجديدة
              </h2>
              <p className="text-xs opacity-60 mt-1">
                أول 60 إشعاراً حديثاً تطابق بحوثاتك المحفوظة.
              </p>
            </div>
            <Link
              href="/notifications"
              className="text-xs rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 font-semibold"
            >
              مركز كل الإشعارات →
            </Link>
          </div>

          {notifList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[.15] dark:border-white/[.2] p-10 text-center">
              <div className="text-3xl mb-2">🔕</div>
              <div className="font-bold mb-1">لا توجد تنبيهات بعد</div>
              <div className="text-sm opacity-60 max-w-md mx-auto">
                بمجرد أن ينشر أحد إعلاناً يطابق أي من بحوثاتك المحفوظة — سيظهر
                تلقائياً هنا مع رابط مباشر له.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notifList.slice(0, 12).map((n) => {
                const slug = (n.link || "").replace(/^\/listing\//, "").replace(/\/.*/, "");
                const listing = listingsBySlug.get(slug);
                return (
                  <div
                    key={n.id}
                    className={[
                      "rounded-2xl border p-4 flex items-stretch gap-4",
                      !n.is_read
                        ? "border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-white to-transparent dark:from-indigo-950/20 dark:via-neutral-900 dark:to-transparent"
                        : "border-black/[.08] dark:border-white/[.145] bg-white/60 dark:bg-neutral-900/60 opacity-90",
                    ].join(" ")}
                  >
                    <div className="shrink-0 grid place-items-center w-14 h-14 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/40 text-2xl">
                      {!n.is_read ? "🆕" : "🔔"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-bold">{n.title}</div>
                          {n.body && (
                            <div className="text-sm opacity-70 mt-0.5">{n.body}</div>
                          )}
                        </div>
                        <div className="text-[11px] opacity-55 shrink-0">
                          {relativeTimeAr(n.created_at)}
                        </div>
                      </div>
                      {listing ? (
                        <div className="mt-3 max-w-md">
                          <ListingCard listing={listing} showFav={false} />
                        </div>
                      ) : (
                        n.link && (
                          <Link
                            href={n.link}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-sky-700 dark:text-sky-300 hover:underline font-semibold"
                          >
                            افتح الإعلان المرتبط ←
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Saved Searches Management */}
        <section>
          <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-extrabold inline-flex items-center gap-2">
                💾 إدارة البحوثات المحفوظة
              </h2>
              <p className="text-xs opacity-60 mt-1">
                ({(searches ?? []).length} بحث محفوظ حالياً)
              </p>
            </div>
            <Link
              href="/search"
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold px-4 py-2 shadow hover:from-indigo-700 hover:to-violet-700"
            >
              🔍 ابدأ بحث جديد
            </Link>
          </div>

          {!searches || searches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[.15] dark:border-white/[.2] p-10 text-center">
              <div className="text-3xl mb-2">📭</div>
              <div className="font-bold mb-1">ما حفظت أي بحث بعد</div>
              <div className="text-sm opacity-60 max-w-md mx-auto mb-3">
                من{" "}
                <Link href="/search" className="underline">صفحة البحث المتقدم</Link>{" "}
                اضغط زر «احفظ البحث» بعد إدخال الفلاتر اللي تريدها، وخلها علينا
                نشوف لك الجديد يومياً.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl mx-auto text-left text-xs opacity-75">
                <div className="rounded-lg border border-black/[.1] dark:border-white/[.15] p-2">
                  💡 مثال: شقق 2 غرف بأقل من 300 ألف
                </div>
                <div className="rounded-lg border border-black/[.1] dark:border-white/[.15] p-2">
                  💡 مثال: كهربائي حي الخالدية
                </div>
                <div className="rounded-lg border border-black/[.1] dark:border-white/[.15] p-2">
                  💡 مثال: تكييف مستعمل بأقل من 600 ر.س
                </div>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {searches.map((search: any) => {
                const params = new URLSearchParams();
                if (search.query) params.set("q", search.query);
                if (search.category_id) params.set("c_id", String(search.category_id));
                if (search.neighborhood_id) params.set("n_id", String(search.neighborhood_id));
                const resultsHref = `/search${params.toString() ? `?${params.toString()}` : ""}`;
                return (
                  <li
                    key={search.id}
                    className="rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-white/70 dark:bg-neutral-900/70 p-4 flex items-stretch justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={resultsHref}
                        className="text-base font-bold inline-flex items-center gap-2 hover:underline line-clamp-2"
                      >
                        {search.query ? `"${search.query}"` : "بحث بدون كلمة مفتاحية"}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs opacity-70">
                        {search.categories?.name_ar && (
                          <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5">
                            📂 {search.categories.name_ar}
                          </span>
                        )}
                        {search.neighborhoods?.name_ar && (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">
                            📍 {search.neighborhoods.name_ar}
                          </span>
                        )}
                        <span className="opacity-70">
                          حُفظ {relativeTimeAr(search.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <Link
                        href={resultsHref}
                        className="text-xs rounded-lg border border-black/[.1] dark:border-white/[.2] px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10 font-semibold"
                      >
                        شوف النتائج
                      </Link>
                      <DeleteSavedSearch
                        onDelete={deleteSavedSearch.bind(null, search.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
