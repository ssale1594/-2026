import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { listingImageUrl } from "@/lib/storage";
import NewsletterForm from "./newsletter-form";

export const metadata: Metadata = {
  title: pageTitle("وش الجديد بالزلفي؟"),
  description: "آخر الإعلانات المنشورة بكل الفئات — محلات، أسر منتجة، خدمات، عقار، ومستعمل.",
};

const FEED_LIMIT = 30;

export default async function WhatsNewPage() {
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, title, slug, price, price_negotiable, published_at, categories(name_ar), sellers(business_name, slug), listing_images(storage_path, is_primary)"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(FEED_LIMIT)
    .returns<
      {
        id: string;
        title: string;
        slug: string;
        price: number | null;
        price_negotiable: boolean;
        published_at: string | null;
        categories: { name_ar: string } | null;
        sellers: { business_name: string; slug: string } | null;
        listing_images: { storage_path: string; is_primary: boolean }[];
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

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">وش الجديد بالزلفي؟</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          آخر الإعلانات اللي نُشرت بكل الفئات.
        </p>

        <div className="mb-8 rounded-xl border border-black/[.08] dark:border-white/[.145] p-4">
          <p className="text-sm font-semibold mb-2">
            📬 ما تبي تفوّتك؟ اشترك تستلم أهم الإعلانات الجديدة كل أسبوع بإيميلك.
          </p>
          <NewsletterForm />
        </div>

        {!listings || listings.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه إعلانات منشورة بعد.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {listings.map((listing) => {
              const primaryImage =
                listing.listing_images?.find((image) => image.is_primary) ??
                listing.listing_images?.[0];

              return (
                <li key={listing.id}>
                  <Link
                    href={`/listing/${listing.slug}`}
                    className="block rounded-lg border border-black/[.08] dark:border-white/[.145] overflow-hidden hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                  >
                    {primaryImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listingImageUrl(primaryImage.storage_path)}
                        alt={listing.title}
                        className="aspect-video w-full object-cover"
                      />
                    )}
                    <div className="p-4">
                      <div className="font-medium mb-1">{listing.title}</div>
                      {listing.price != null && (
                        <div className="text-sm text-black/60 dark:text-white/60">
                          {listing.price} ر.س
                          {listing.price_negotiable ? " (قابل للتفاوض)" : ""}
                        </div>
                      )}
                      <div className="text-xs text-black/40 dark:text-white/40 mt-2 flex items-center justify-between">
                        <span>{listing.sellers?.business_name}</span>
                        {listing.categories && <span>{listing.categories.name_ar}</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
