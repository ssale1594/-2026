import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { getSellerBySlug } from "@/lib/data/sellers";
import { relativeTimeAr } from "@/lib/relative-time";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getSellerBySlug(slug);

  if (!seller) {
    return { title: pageTitle("بائع غير موجود") };
  }

  return {
    title: pageTitle(`${seller.business_name} بالزلفي`),
    description:
      seller.description?.slice(0, 160) ??
      `${seller.business_name} بالزلفي — تصفح إعلاناته وتواصل مباشرة عبر واتساب.`,
  };
}

export default async function SellerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seller = await getSellerBySlug(slug);

  if (!seller) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: listings }, { data: ratingRows }, { data: reviews }] =
    await Promise.all([
      supabase
        .from("listings")
        .select("id, title, slug, price, price_negotiable")
        .eq("seller_id", seller.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase.rpc("seller_rating", { p_seller_id: seller.id }),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<
          { id: number; rating: number; comment: string | null; created_at: string }[]
        >(),
    ]);

  const rating = (ratingRows as { average: number | null; total: number }[] | null)?.[0];

  // wa.me requires digits only (country code, no leading +/00/spaces).
  const whatsappHref = `https://wa.me/${seller.whatsapp_number.replace(/\D/g, "")}`;

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">{seller.business_name}</h1>
            {rating && rating.total > 0 && (
              <div className="text-sm text-black/60 dark:text-white/60 mt-1">
                ★ {rating.average} · {rating.total} تقييم موثّق
              </div>
            )}
            {seller.description && (
              <p className="text-black/60 dark:text-white/60 mt-1">
                {seller.description}
              </p>
            )}
          </div>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-green-600 text-white text-sm font-medium px-4 py-2 hover:bg-green-700 transition-colors shrink-0"
          >
            تواصل واتساب
          </a>
        </div>

        <h2 className="text-lg font-semibold mb-4">إعلانات البائع</h2>

        {!listings || listings.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه إعلانات منشورة لهذا البائع حاليًا.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link
                  href={`/listing/${listing.slug}`}
                  className="block rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                >
                  <div className="font-medium mb-1">{listing.title}</div>
                  {listing.price != null && (
                    <div className="text-sm text-black/60 dark:text-white/60">
                      {listing.price} ر.س
                      {listing.price_negotiable ? " (قابل للتفاوض)" : ""}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {reviews && reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-1">تقييمات موثّقة</h2>
            <p className="text-xs text-black/50 dark:text-white/50 mb-4">
              كل تقييم هنا من عميل أكّد البائع نفسه إنه تعامل معه.
            </p>
            <ul className="flex flex-col gap-3">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
                >
                  <div className="text-sm">{"★".repeat(review.rating)}</div>
                  {review.comment && (
                    <p className="text-sm text-black/70 dark:text-white/70 mt-1">
                      {review.comment}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                    {relativeTimeAr(review.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
