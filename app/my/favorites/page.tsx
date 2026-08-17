import Link from "next/link";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { listingImageUrl } from "@/lib/storage";
import FavoriteButton from "@/components/favorite-button";
import { siteName } from "@/lib/seo";

export const metadata = {
  title: "قائمة المفضلة — " + siteName,
  description: "كل ما حفظته من إعلانات في سوق الزلفي في مكان واحد.",
};

export default async function FavoritesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const favsQ = await supabase
    .from("favorite_listings")
    .select("listing_id, saved_at")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });
  const favs = favsQ.data ?? [];

  let listings: any[] = [];
  if (favs.length > 0) {
    const ids = favs.map((f: any) => f.listing_id);
    const savedAtMap = new Map(favs.map((f: any) => [f.listing_id, f.saved_at]));
    const listQ = await supabase
      .from("listings")
      .select(
        "id, title, slug, status, price, price_negotiable, view_count, contact_click_count, description, created_at, " +
          "neighborhoods(name_ar), categories(name_ar), profiles(business_name, slug, trust_level, verification_status), " +
          "listing_images(storage_path, is_primary)"
      )
      .in("id", ids);
    listings = (listQ.data ?? [])
      .filter((l: any) => l)
      .map((l: any) => ({ ...l, saved_at: savedAtMap.get(l.id) }))
      .sort(
        (a: any, b: any) =>
          new Date(savedAtMap.get(b.id) ?? 0).getTime() -
          new Date(savedAtMap.get(a.id) ?? 0).getTime()
      );
  }

  const active = listings.filter((l) => l.status === "published");
  const archived = listings.filter((l) => l.status !== "published");

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <header className="sticky top-0 z-40 border-b border-black/[.08] dark:border-white/[.145] bg-white/90 dark:bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="font-bold inline-flex items-center gap-2">
            🏬 {siteName}
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">الرئيسية</Link>
            <Link href="/my/saved-searches" className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
              🔎 عمليات بحثي
            </Link>
            <Link href="/my/transactions" className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
              💸 معاملاتي
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold inline-flex items-center gap-2">
              ❤️ المفضلة الخاصة بي
            </h1>
            <p className="text-sm text-black/60 dark:text-white/60 mt-1">
              {listings.length} إعلان محفوظ
              {active.length !== listings.length && (
                <> · <b className="text-rose-600">{archived.length}</b> غير متاح</>
              )}
            </p>
          </div>
          <Link
            href="/search"
            className="text-sm rounded-lg bg-foreground text-background px-4 py-2 font-semibold hover:opacity-90"
          >
            ➕ تصفح المزيد من الإعلانات
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-black/[.15] dark:border-white/[.25]">
            <div className="text-6xl mb-4">🤍</div>
            <h2 className="text-xl font-bold mb-1">لا توجد إعلانات محفوظة بعد</h2>
            <p className="text-sm text-black/60 dark:text-white/60 mb-6 max-w-lg mx-auto">
              اضغط على زر المفضلة ❤️ عند أي إعلان تحبه ليظهر هنا — تقدر تراجعها لاحقًا وتقارن بينها أو تشاركها مع العائلة!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/search"
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 font-semibold text-sm"
              >
                ابدأ بالبحث
              </Link>
              <Link
                href="/needs"
                className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-5 py-2.5 text-sm"
              >
                تصفح الاحتياجات
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3">
                  ✅ متاح للشراء ({active.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {active.map((l) => (
                    <FavCard key={l.id} listing={l} userId={user.id} initialFav />
                  ))}
                </div>
              </section>
            )}
            {archived.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3 opacity-75">
                  ⚫ مؤرشف / محذوف ({archived.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                  {archived.map((l) => (
                    <FavCard
                      key={l.id}
                      listing={{ ...l, archived: true }}
                      userId={user.id}
                      initialFav
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function FavCard({
  listing,
  userId,
  initialFav,
}: {
  listing: any;
  userId: string;
  initialFav?: boolean;
}) {
  const img = listing.listing_images?.[0]?.storage_path;
  const seller = listing.profiles;
  const neigh = listing.neighborhoods;
  const cat = listing.categories;
  const archived = listing.archived || listing.status !== "published";

  return (
    <div
      className={[
        "group rounded-2xl border overflow-hidden bg-white dark:bg-black/5 transition-all",
        archived
          ? "border-black/[.06] dark:border-white/[.08]"
          : "border-black/[.08] dark:border-white/[.145] hover:shadow-md hover:-translate-y-0.5",
      ].join(" ")}
    >
      <Link href={`/listing/${listing.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-black/[.04] overflow-hidden">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listingImageUrl(img)}
              alt={listing.title}
              className={["w-full h-full object-cover", archived ? "grayscale opacity-70" : ""].join(" ")}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">
              🖼️
            </div>
          )}
          <div className="absolute top-2 left-2 z-10">
            <FavoriteButton
              listingId={listing.id}
              initialIsFav={initialFav}
              size="sm"
            />
          </div>
          {listing.price_negotiable && !archived && (
            <span className="absolute top-2 right-2 z-10 text-[11px] rounded-full bg-amber-500/90 text-white px-2.5 py-0.5 font-bold shadow-sm">
              قابل للتفاوض
            </span>
          )}
          {archived && (
            <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs px-3 py-1.5 text-center font-bold z-10">
              {listing.status === "archived" ? "مؤرشف من قبل البائع" : "غير متاح حالياً"}
            </span>
          )}
        </div>
      </Link>
      <div className="p-3.5">
        <Link href={`/listing/${listing.slug}`} className="block">
          <div className="font-bold text-sm line-clamp-2 mb-1.5 leading-snug group-hover:text-sky-700 dark:group-hover:text-sky-300 transition">
            {listing.title}
          </div>
        </Link>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          {listing.price != null ? (
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
              {listing.price} <span className="text-xs font-semibold opacity-80">ر.س</span>
            </div>
          ) : (
            <div className="text-sm opacity-60 italic">السعر عند الاتصال</div>
          )}
          <div className="text-[11px] opacity-60 shrink-0">
            👁️ {listing.view_count ?? 0}
          </div>
        </div>
        <div className="text-[11px] opacity-65 flex flex-wrap gap-x-2 gap-y-1 mb-2.5 leading-relaxed">
          {neigh?.name_ar && <>📍 {neigh.name_ar}</>}
          {cat?.name_ar && <>· 📂 {cat.name_ar}</>}
        </div>
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-black/[.05] dark:border-white/[.08]">
          {seller?.slug ? (
            <Link
              href={`/seller/${seller.slug}`}
              className="font-semibold truncate hover:text-sky-700 dark:hover:text-sky-300"
            >
              🏪 {seller.business_name || seller.id}
              {seller.verification_status === "approved" && (
                <span className="text-[9px] ml-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 font-bold">
                  ✓
                </span>
              )}
            </Link>
          ) : (
            <span className="truncate opacity-60">بائع</span>
          )}
          {listing.saved_at && (
            <span className="opacity-60 shrink-0">
              {new Date(listing.saved_at).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
