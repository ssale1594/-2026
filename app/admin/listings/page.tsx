import Link from "next/link";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { setListingStatus } from "../actions";
import ReviewButtons from "../review-buttons";

export default async function AdminListingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, description, price, sellers(business_name), categories(name_ar)")
    .eq("status", "pending_review")
    .order("created_at")
    .returns<
      {
        id: string;
        title: string;
        description: string | null;
        price: number | null;
        sellers: { business_name: string } | null;
        categories: { name_ar: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <span className="text-lg font-bold">لوحة الإدارة</span>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/sellers" className="text-black/60 dark:text-white/60">
              البائعون
            </Link>
            <span>الإعلانات</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">إعلانات بانتظار المراجعة</h1>

        {!listings || listings.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه إعلانات جديدة.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{listing.title}</div>
                  <div className="text-sm text-black/60 dark:text-white/60 mt-1">
                    {listing.sellers?.business_name}
                    {listing.categories && ` · ${listing.categories.name_ar}`}
                    {listing.price != null && ` · ${listing.price} ر.س`}
                  </div>
                  {listing.description && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {listing.description}
                    </p>
                  )}
                </div>
                <ReviewButtons
                  onApprove={async () => {
                    "use server";
                    await setListingStatus(listing.id, "published");
                  }}
                  onReject={async () => {
                    "use server";
                    await setListingStatus(listing.id, "rejected");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
