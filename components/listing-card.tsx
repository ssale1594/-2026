import Link from "next/link";
import { listingImageUrl } from "@/lib/storage";
import FavoriteButton from "./favorite-button";
import PremiumBadge from "./premium-badge";

type Tier = "free" | "silver" | "gold" | "diamond";

type Listing = {
  id: string;
  title: string;
  slug: string;
  status?: string;
  price?: number | null;
  price_negotiable?: boolean | null;
  view_count?: number | null;
  contact_click_count?: number | null;
  categories?: { name_ar: string } | null;
  neighborhoods?: { name_ar: string; slug?: string } | null;
  // العلاقة المضمّنة اسمها sellers لا profiles: business_name/slug تعيش
  // في sellers، وlistings.seller_id يشير إليها.
  sellers?: { business_name?: string | null; slug?: string | null; verification_status?: string; tier?: Tier | null } | null;
  seller_tier?: Tier | null;
  listing_images?: { storage_path: string; is_primary?: boolean }[] | null;
  created_at?: string | null;
  isFav?: boolean;
  is_featured?: boolean;
};

export default function ListingCard({
  listing,
  showFav = true,
  className = "",
}: {
  listing: Listing;
  showFav?: boolean;
  className?: string;
}) {
  const img = listing.listing_images?.[0]?.storage_path;
  const hasImages = (listing.listing_images?.length ?? 0) > 0;
  const cat = listing.categories;
  const neigh = listing.neighborhoods;
  const seller = listing.sellers;
  const tier = listing.seller_tier ?? seller?.tier ?? null;

  return (
    <div
      className={[
        "group rounded-2xl border overflow-hidden bg-white dark:bg-black/5 transition-all hover:shadow-lg hover:-translate-y-0.5",
        listing.is_featured
          ? "border-amber-500/60 ring-1 ring-amber-500/30 shadow-amber-500/10"
          : "border-black/[.08] dark:border-white/[.145]",
        className,
      ].join(" ")}
    >
      <Link href={`/listing/${listing.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-black/[.04] dark:bg-white/[.06] overflow-hidden">
          {hasImages && img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listingImageUrl(img)}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">
              📦
            </div>
          )}
          {(listing.is_featured || tier) && (
            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
              {listing.is_featured && (
                <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 shadow shadow-amber-500/30">
                  ✨ مميّز
                </div>
              )}
              {tier && <PremiumBadge tier={tier} compact />}
            </div>
          )}
          {showFav && (
            <div className="absolute top-2 left-2 z-10">
              <FavoriteButton listingId={listing.id} initialIsFav={listing.isFav} size="sm" />
            </div>
          )}
          {listing.price_negotiable && (
            <span className="absolute bottom-2 right-2 z-10 text-[11px] rounded-full bg-amber-500/90 text-white px-2.5 py-0.5 font-bold shadow-sm">
              قابل للتفاوض
            </span>
          )}
          {!hasImages && (
            <span className="absolute bottom-2 left-2 z-10 text-[10px] rounded-full bg-black/60 text-white px-2 py-0.5">
              بدون صور
            </span>
          )}
        </div>
      </Link>
      <div className="p-3.5">
        <Link href={`/listing/${listing.slug}`} className="block">
          <div className="font-bold text-sm line-clamp-2 mb-1.5 leading-snug group-hover:text-sky-700 dark:group-hover:text-sky-300 transition min-h-[2.6rem]">
            {listing.title}
          </div>
        </Link>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          {listing.price != null ? (
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
              {listing.price.toLocaleString("ar-SA")}{" "}
              <span className="text-xs font-semibold opacity-80">ر.س</span>
            </div>
          ) : (
            <div className="text-sm opacity-60 italic">السعر عند الاتصال</div>
          )}
          {listing.view_count != null && listing.view_count > 0 && (
            <div className="text-[11px] opacity-60 shrink-0">
              👁️ {listing.view_count.toLocaleString("ar-SA")}
            </div>
          )}
        </div>
        <div className="text-[11px] opacity-65 flex flex-wrap gap-x-2 gap-y-1 mb-2.5 leading-relaxed min-h-[1.6rem]">
          {neigh?.name_ar && <>📍 {neigh.name_ar}</>}
          {cat?.name_ar && <>· 📂 {cat.name_ar}</>}
        </div>
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-black/[.05] dark:border-white/[.08]">
          {seller?.slug ? (
            <Link
              href={`/seller/${seller.slug}`}
              className="font-semibold truncate hover:text-sky-700 dark:hover:text-sky-300 max-w-[11rem]"
              title={seller.business_name || seller.slug}
            >
              🏪 {seller.business_name || seller.slug}
              {seller.verification_status === "approved" && (
                <span className="text-[9px] ml-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 font-bold">
                  ✓
                </span>
              )}
            </Link>
          ) : (
            <span className="truncate opacity-60">بائع</span>
          )}
          {listing.created_at && (
            <span className="opacity-60 shrink-0">
              {new Date(listing.created_at).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
