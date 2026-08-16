import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageTitle, siteName } from "@/lib/seo";
import { listingImageUrl } from "@/lib/storage";
import { getListingBySlug } from "@/lib/data/listings";
import { relativeTimeAr } from "@/lib/relative-time";
import { createClient } from "@/lib/supabase/server";
import WhatsappButton from "./whatsapp-button";
import ViewTracker from "./view-tracker";
import ClaimButton from "./claim-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    return { title: pageTitle("إعلان غير موجود") };
  }

  return {
    title: pageTitle(
      listing.sellers
        ? `${listing.title} — ${listing.sellers.business_name}`
        : listing.title
    ),
    description:
      listing.description?.slice(0, 160) ??
      `${listing.title} بالزلفي — تواصل مباشرة عبر واتساب.`,
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    notFound();
  }

  const images = [...(listing.listing_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: ratingRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    listing.sellers
      ? supabase.rpc("seller_rating", { p_seller_id: listing.sellers.id })
      : Promise.resolve({ data: null }),
  ]);

  const rating = (ratingRows as { average: number | null; total: number }[] | null)?.[0];

  return (
    <div className="min-h-screen font-sans">
      <ViewTracker listingId={listing.id} />
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.storage_path}
                src={listingImageUrl(image.storage_path)}
                alt={listing.title}
                className="aspect-video w-full rounded-lg object-cover bg-black/[.04] dark:bg-white/[.06]"
              />
            ))}
          </div>
        )}

        <h1 className="text-2xl font-semibold mb-1">{listing.title}</h1>

        <div className="text-xs text-black/40 dark:text-white/40 mb-2">
          آخر تحديث: {relativeTimeAr(listing.updated_at)} · شوهد {listing.view_count} مرة
          {listing.contact_click_count > 0 &&
            ` · تواصل معه ${listing.contact_click_count} مرة`}
        </div>

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

        {listing.neighborhoods && (
          <Link
            href={`/neighborhood/${listing.neighborhoods.slug}`}
            className="inline-block text-sm text-black/60 dark:text-white/60 hover:underline mb-6"
          >
            حي {listing.neighborhoods.name_ar}
          </Link>
        )}

        {listing.sellers && (
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{listing.sellers.business_name}</div>
                {rating && rating.total > 0 && (
                  <div className="text-sm text-black/60 dark:text-white/60">
                    ★ {rating.average} · {rating.total} تقييم موثّق
                  </div>
                )}
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
            <ClaimButton
              listingId={listing.id}
              sellerId={listing.sellers.id}
              isSignedIn={Boolean(user)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
