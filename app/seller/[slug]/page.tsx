import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SellerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("sellers")
    .select("id, business_name, business_type, description, whatsapp_number")
    .eq("slug", slug)
    .eq("verification_status", "approved")
    .single();

  if (!seller) {
    notFound();
  }

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, slug, price, price_negotiable")
    .eq("seller_id", seller.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // wa.me requires digits only (country code, no leading +/00/spaces).
  const whatsappHref = `https://wa.me/${seller.whatsapp_number.replace(/\D/g, "")}`;

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            سوق الزلفي
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">{seller.business_name}</h1>
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
      </main>
    </div>
  );
}
