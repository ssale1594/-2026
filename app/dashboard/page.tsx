import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "./dashboard-header";
import ArchiveButton from "./archive-button";

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

  // Mirrors can_create_listing() (supabase/migrations/00000000000001_initial_schema.sql):
  // an active subscription lifts the free-tier cap entirely, so the UI gate
  // has to check for one too — otherwise a paying seller who's past the free
  // count sees the "subscribe" dead-end even though RLS would let them post.
  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("seller_id", seller.id)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .maybeSingle();

  const reachedLimit =
    !activeSubscription &&
    seller.active_listings_count >= seller.free_listing_limit;

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader sellerName={seller.business_name} />

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
            <Link
              href="/dashboard/subscription"
              className="text-sm text-blue-600 hover:underline"
            >
              وصلت الحد المجاني — اشترك لإضافة المزيد
            </Link>
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
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-xs text-black/50 dark:text-white/50">
                    {listing.view_count} مشاهدة · {listing.contact_click_count}{" "}
                    تواصل
                  </div>
                  <Link
                    href={`/dashboard/listings/${listing.id}/edit`}
                    className="text-sm text-black/60 dark:text-white/60 hover:underline"
                  >
                    تعديل
                  </Link>
                  {listing.status !== "archived" && (
                    <ArchiveButton listingId={listing.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
