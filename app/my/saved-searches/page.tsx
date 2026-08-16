import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import DeleteSavedSearch from "./delete-saved-search";
import { deleteSavedSearch } from "./actions";

export const metadata: Metadata = {
  title: pageTitle("بحوثاتي المحفوظة"),
  robots: { index: false, follow: false },
};

export default async function SavedSearchesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: searches } = await supabase
    .from("saved_searches")
    .select("id, query, created_at, categories(name_ar)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: number;
        query: string;
        created_at: string;
        categories: { name_ar: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">بحوثاتي المحفوظة</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          نبلغك بإشعار أول ما ينشر إعلان جديد يطابق أي بحث محفوظ هنا.
        </p>

        {!searches || searches.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما حفظت أي بحث بعد — من{" "}
            <Link href="/search" className="underline">
              صفحة البحث
            </Link>{" "}
            اضغط &quot;احفظ البحث&quot;.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {searches.map((search) => (
              <li
                key={search.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <Link
                    href={`/search?q=${encodeURIComponent(search.query)}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {search.query}
                  </Link>
                  <div className="text-xs text-black/40 dark:text-white/40 mt-1">
                    {search.categories && `${search.categories.name_ar} · `}
                    حُفظ {relativeTimeAr(search.created_at)}
                  </div>
                </div>
                <DeleteSavedSearch
                  onDelete={async () => {
                    "use server";
                    await deleteSavedSearch(search.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
