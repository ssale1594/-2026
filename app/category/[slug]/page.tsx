import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("name_ar")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!category) {
    return { title: pageTitle("فئة غير موجودة") };
  }

  return {
    title: pageTitle(`${category.name_ar} بالزلفي`),
    description: `تصفح ${category.name_ar} بالزلفي — تواصل مباشرة مع البائع عبر واتساب.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name_ar, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!category) {
    notFound();
  }

  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, title, slug, price, price_negotiable, is_featured, sellers(business_name, slug), listing_images(storage_path, is_primary)"
    )
    .eq("category_id", category.id)
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <nav className="text-sm text-black/60 dark:text-white/60">
            {category.name_ar}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">{category.name_ar}</h1>

        {!listings || listings.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه إعلانات منشورة بهذي الفئة حاليًا.
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
                  {listing.sellers && (
                    <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                      {listing.sellers.business_name}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
