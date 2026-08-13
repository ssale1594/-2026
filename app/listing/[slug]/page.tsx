import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WhatsappButton from "./whatsapp-button";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, title, description, price, price_negotiable, categories(name_ar, slug), sellers(business_name, whatsapp_number, slug), listing_images(storage_path, is_primary, sort_order)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!listing) {
    notFound();
  }

  const images = [...(listing.listing_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            سوق الزلفي
          </Link>
          {listing.categories && (
            <Link
              href={`/category/${listing.categories.slug}`}
              className="text-sm text-black/60 dark:text-white/60"
            >
              {listing.categories.name_ar}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {images.length === 0 ? (
          <div className="w-full aspect-video rounded-lg bg-black/[.04] dark:bg-white/[.06] flex items-center justify-center text-black/40 dark:text-white/40 mb-6">
            لا توجد صور
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-6">
            {images.map((image) => (
              <div
                key={image.storage_path}
                className="aspect-video rounded-lg bg-black/[.04] dark:bg-white/[.06]"
              />
            ))}
          </div>
        )}

        <h1 className="text-2xl font-semibold mb-2">{listing.title}</h1>

        {listing.price != null && (
          <div className="text-lg mb-4">
            {listing.price} ر.س
            {listing.price_negotiable ? " (قابل للتفاوض)" : ""}
          </div>
        )}

        {listing.description && (
          <p className="text-black/80 dark:text-white/80 whitespace-pre-line mb-8">
            {listing.description}
          </p>
        )}

        {listing.sellers && (
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{listing.sellers.business_name}</div>
              <Link
                href={`/seller/${listing.sellers.slug}`}
                className="text-sm text-black/60 dark:text-white/60 hover:underline"
              >
                عرض صفحة البائع
              </Link>
            </div>
            <WhatsappButton
              listingId={listing.id}
              whatsappNumber={listing.sellers.whatsapp_number}
              listingTitle={listing.title}
            />
          </div>
        )}
      </main>
    </div>
  );
}
