import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageTitle, siteName } from "@/lib/seo";
import { listingImageUrl } from "@/lib/storage";
import { getListingBySlug } from "@/lib/data/listings";
import { relativeTimeAr } from "@/lib/relative-time";
import { createClient } from "@/lib/supabase/server";
import { getSellerTrust } from "@/lib/data/trust";
import TrustBadge from "@/components/trust-badge";
import WhatsappButton from "./whatsapp-button";
import ViewTracker from "./view-tracker";
import ClaimButton from "./claim-button";
import FavoriteButton from "@/components/favorite-button";
import ReportDialog from "@/components/report-dialog";
import ListingCard from "@/components/listing-card";
import StartDealDialog from "@/components/start-deal-dialog";
import StartChatButton from "@/app/my/inbox/start-chat-button";
import OfferButton from "@/components/offer-button";

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

  // Resolved first: the favourite lookup below is keyed on the user, and
  // reading it out of the same destructuring it belongs to is a
  // temporal-dead-zone throw, not just a type error.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: ratingRows }, trust, { data: favRow }, relatedQ] =
    await Promise.all([
    listing.sellers
      ? supabase.rpc("seller_rating", { p_seller_id: listing.sellers.id })
      : Promise.resolve({ data: null }),
    listing.sellers ? getSellerTrust(listing.sellers.id) : Promise.resolve(null),
    user
      ? supabase
          .from("favorite_listings")
          .select("id")
          .eq("user_id", user.id)
          .eq("listing_id", listing.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    (async () => {
      const q = await (supabase.rpc as any)("get_related_listings", {
        p_listing_id: listing.id,
        p_limit: 8,
      });
      const ids = (q.data ?? []).map((x: any) => x.id);
      if (ids.length === 0) return [];
      const fullQ = await supabase
        .from("listings")
        .select(
          "id, title, slug, status, price, price_negotiable, view_count, contact_click_count, created_at, " +
            "categories(name_ar), neighborhoods(name_ar, slug), profiles(business_name, slug, trust_level, verification_status), " +
            "listing_images(storage_path, is_primary)"
        )
        .in("id", ids);
      const map = new Map((fullQ.data ?? []).map((x: any) => [x.id, x]));
      return ids.map((id: any) => map.get(id)).filter(Boolean);
    })(),
  ]);

  const rating = (ratingRows as { average: number | null; total: number }[] | null)?.[0];
  const isFav = Boolean(favRow);

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

        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-2xl font-semibold leading-tight">{listing.title}</h1>
          {user && (
            <div className="shrink-0 mt-1">
              <FavoriteButton listingId={listing.id} initialIsFav={isFav} size="lg" />
            </div>
          )}
        </div>

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
          <div className="flex items-center justify-between gap-3 mb-6">
            <Link
              href={`/neighborhood/${listing.neighborhoods.slug}`}
              className="inline-block text-sm text-black/60 dark:text-white/60 hover:underline"
            >
              📍 حي {listing.neighborhoods.name_ar}
            </Link>
            {user && <ReportDialog targetType="listing" targetId={listing.id} label="الإبلاغ عن الإعلان" />}
          </div>
        )}

        {!listing.neighborhoods && user && (
          <div className="flex justify-end mb-6">
            <ReportDialog targetType="listing" targetId={listing.id} label="الإبلاغ عن الإعلان" />
          </div>
        )}

        {listing.sellers && (
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{listing.sellers.business_name}</div>
                <div className="mt-1 mb-1">
                  <TrustBadge trust={trust} />
                </div>
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
              <div className="flex flex-col items-end gap-2">
                <WhatsappButton
                  listingId={listing.id}
                  whatsappNumber={listing.sellers.whatsapp_number}
                  listingTitle={listing.title}
                />
                {user && user.id !== listing.sellers.id && (
                  <>
                    <OfferButton
                      listingId={listing.id}
                      listingTitle={listing.title}
                      listingPrice={listing.price ?? null}
                      sellerId={listing.sellers.id}
                      compact
                    />
                    <StartChatButton
                      listingId={listing.id}
                      sellerId={listing.sellers.id}
                      sellerName={listing.sellers.business_name}
                      subject={`استفسار عن الإعلان: ${listing.title}`}
                      label="💬 تواصل داخل المنصة"
                      variant="subtle"
                      className="!py-1.5 !text-xs !w-full justify-center"
                    />
                    <StartDealDialog
                      listingId={listing.id}
                      listingTitle={listing.title}
                      listingPrice={listing.price ?? null}
                      sellerId={listing.sellers.id}
                      sellerName={listing.sellers.business_name}
                      className="!py-1.5 !text-xs"
                    />
                  </>
                )}
              </div>
            </div>
            <ClaimButton
              listingId={listing.id}
              sellerId={listing.sellers.id}
              isSignedIn={Boolean(user)}
            />
          </div>
        )}

        {(relatedQ as any[])?.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-bold inline-flex items-center gap-2 mb-1">
              💡 قد يعجبك أيضاً
            </h2>
            <p className="text-sm text-black/55 dark:text-white/60 mb-5">
              منتجات وخدمات مشابهة من نفس الفئة أو الحي أو بنفس نطاق السعر.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(relatedQ as any[]).slice(0, 4).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            {(relatedQ as any[]).length > 4 && (
              <div className="mt-4 text-center">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-5 py-2.5 hover:bg-black/5 dark:hover:bg-white/10 font-semibold"
                >
                  اكتشف المزيد من الإعلانات المشابهة ←
                </Link>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
