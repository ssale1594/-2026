import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { listingImageUrl } from "@/lib/storage";
import { getNeighborhoodBySlug } from "@/lib/data/neighborhoods";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const neighborhood = await getNeighborhoodBySlug(slug);

  if (!neighborhood) {
    return { title: pageTitle("حي غير موجود") };
  }

  return {
    title: pageTitle(`حي ${neighborhood.name_ar} — الزلفي`),
    description: `تصفح محلات وخدمات وإعلانات حي ${neighborhood.name_ar} بالزلفي — تواصل مباشرة مع البائع عبر واتساب.`,
  };
}

export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const neighborhood = await getNeighborhoodBySlug(slug);

  if (!neighborhood) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: listings }, ambassadorsQ] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, slug, price, price_negotiable, is_featured, categories(name_ar), sellers(business_name, slug), listing_images(storage_path, is_primary)"
      )
      .eq("neighborhood_id", neighborhood.id)
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          title: string;
          slug: string;
          price: number | null;
          price_negotiable: boolean;
          is_featured: boolean;
          categories: { name_ar: string } | null;
          sellers: { business_name: string; slug: string } | null;
          listing_images: { storage_path: string; is_primary: boolean }[];
        }[]
      >(),
    supabase.rpc("neighborhood_ambassadors_public", {
      p_neighborhood_id: neighborhood.id,
    }),
  ]);

  const ambassadors =
    (ambassadorsQ.data as {
      display_name: string;
      is_seller: boolean;
      seller_slug: string | null;
    }[]) ?? [];

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <nav className="text-sm text-black/60 dark:text-white/60">
            حي {neighborhood.name_ar}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">
          إعلانات حي {neighborhood.name_ar}
        </h1>

        {ambassadors.length > 0 && (
          <p className="text-sm text-black/60 dark:text-white/60 mb-6">
            🙌 سفراء الحي:{" "}
            {ambassadors.map((a, i) => (
              <span key={i}>
                {a.is_seller && a.seller_slug ? (
                  <Link href={`/seller/${a.seller_slug}`} className="underline hover:no-underline">
                    {a.display_name}
                  </Link>
                ) : (
                  a.display_name
                )}
                {i < ambassadors.length - 1 && "، "}
              </span>
            ))}
          </p>
        )}
        {ambassadors.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50 mb-6">
            ما فيه سفير لهذا الحي بعد —{" "}
            <Link href="/ambassadors" className="underline hover:no-underline">
              كن أول سفير له
            </Link>
            .
          </p>
        )}

        {!listings || listings.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه إعلانات منشورة بهذا الحي حاليًا.
          </p>
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
                        {listing.categories && (
                          <span>{listing.categories.name_ar}</span>
                        )}
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
