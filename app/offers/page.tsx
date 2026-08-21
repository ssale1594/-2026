import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: pageTitle("عروض اليوم"),
  description: "عروض محدودة بوقت من محلات وأسر منتجة بالزلفي.",
};

export default async function OffersPage() {
  const supabase = await createClient();

  // RLS already restricts this to published offers inside their window, so an
  // expired offer disappears with no cleanup job involved.
  const { data: offers } = await supabase
    .from("offers")
    .select("id, title, description, ends_at, sellers(business_name, slug), listings(title, slug)")
    .order("ends_at")
    .returns<
      {
        id: number;
        title: string;
        description: string | null;
        ends_at: string;
        sellers: { business_name: string; slug: string } | null;
        listings: { title: string; slug: string } | null;
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
        <h1 className="text-xl font-semibold mb-2">عروض اليوم</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          عروض محدودة بوقت — تنتهي تلقائيًا بانتهاء مدتها.
        </p>

        {!offers || offers.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه عروض سارية حاليًا.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <div className="font-medium mb-1">{offer.title}</div>
                {offer.description && (
                  <p className="text-sm text-black/70 dark:text-white/70 whitespace-pre-line mb-2">
                    {offer.description}
                  </p>
                )}
                <div className="text-xs text-black/40 dark:text-white/40 flex flex-wrap gap-x-3 gap-y-1">
                  {offer.sellers && (
                    <Link
                      href={`/seller/${offer.sellers.slug}`}
                      className="hover:underline"
                    >
                      {offer.sellers.business_name}
                    </Link>
                  )}
                  {offer.listings && (
                    <Link
                      href={`/listing/${offer.listings.slug}`}
                      className="hover:underline"
                    >
                      {offer.listings.title}
                    </Link>
                  )}
                  <span>
                    ينتهي {new Date(offer.ends_at).toLocaleDateString("ar")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
