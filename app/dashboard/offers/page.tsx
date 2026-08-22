import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "../dashboard-header";
import OfferForm from "./offer-form";
import DeleteOfferButton from "./delete-offer-button";
import { deleteOffer } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  pending_review: "قيد المراجعة",
  published: "منشور",
  rejected: "مرفوض",
};

export default async function DashboardOffersPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const [{ data: listings }, { data: offers }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title")
      .eq("seller_id", seller.id)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    supabase
      .from("offers")
      .select("id, title, status, starts_at, ends_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">عروضي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          العرض ينتهي تلقائيًا بتاريخ نهايته — ما تحتاج تحذفه بنفسك.
        </p>

        {seller.verification_status === "approved" ? (
          <OfferForm listings={listings ?? []} />
        ) : (
          <p className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-3 text-sm text-black/60 dark:text-white/60 mb-8">
            نشر العروض يفتح بعد اعتماد حسابك.
          </p>
        )}

        <h2 className="font-semibold mb-3">كل عروضك</h2>
        {!offers || offers.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            ما نشرت أي عرض بعد.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{offer.title}</div>
                  <div className="text-xs text-black/40 dark:text-white/40 mt-1">
                    {STATUS_LABELS[offer.status]} ·{" "}
                    {new Date(offer.starts_at).toLocaleDateString("ar")} —{" "}
                    {new Date(offer.ends_at).toLocaleDateString("ar")}
                  </div>
                </div>
                <DeleteOfferButton onDelete={deleteOffer.bind(null, offer.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
