import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending_review: "قيد المراجعة",
  published: "منشور",
  rejected: "مرفوض",
  paused: "متوقف",
  expired: "منتهي",
  archived: "مؤرشف",
};

export default async function DashboardPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, slug, status, price, view_count, contact_click_count")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  const reachedLimit = seller.active_listings_count >= seller.free_listing_limit;

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            سوق الزلفي
          </Link>
          <span className="text-sm text-black/60 dark:text-white/60">
            {seller.business_name}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {seller.verification_status !== "approved" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm mb-6">
            حسابك قيد المراجعة — إعلاناتك ما تظهر للزوار لين يتم اعتماد الحساب.
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">إعلاناتي</h1>
            <p className="text-sm text-black/60 dark:text-white/60 mt-1">
              {seller.active_listings_count} من {seller.free_listing_limit} إعلان
              منشور
            </p>
          </div>
          {reachedLimit ? (
            <span className="text-sm text-black/60 dark:text-white/60">
              وصلت الحد المجاني — اشترك لإضافة المزيد
            </span>
          ) : (
            <Link
              href="/dashboard/listings/new"
              className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2"
            >
              إضافة إعلان
            </Link>
          )}
        </div>

        {!listings || listings.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما أضفت أي إعلان بعد.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{listing.title}</div>
                  <div className="text-sm text-black/60 dark:text-white/60 mt-1">
                    {STATUS_LABELS[listing.status] ?? listing.status}
                    {listing.price != null && ` · ${listing.price} ر.س`}
                  </div>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50 shrink-0">
                  {listing.view_count} مشاهدة · {listing.contact_click_count} تواصل
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
