import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import ReviewButtons from "../review-buttons";
import { setOfferStatus } from "../actions";

export default async function AdminOffersPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: offers } = await supabase
    .from("offers")
    .select("id, title, description, starts_at, ends_at, sellers(business_name)")
    .eq("status", "pending_review")
    .order("created_at")
    .returns<
      {
        id: number;
        title: string;
        description: string | null;
        starts_at: string;
        ends_at: string;
        sellers: { business_name: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="offers" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">عروض بانتظار المراجعة</h1>

        {!offers || offers.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه عروض جديدة.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{offer.title}</div>
                  <div className="text-sm text-black/60 dark:text-white/60 mt-1">
                    {offer.sellers?.business_name}
                  </div>
                  {offer.description && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {offer.description}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                    {new Date(offer.starts_at).toLocaleDateString("ar")} —{" "}
                    {new Date(offer.ends_at).toLocaleDateString("ar")}
                  </div>
                </div>
                <ReviewButtons
                  onApprove={async () => {
                    "use server";
                    await setOfferStatus(offer.id, "published");
                  }}
                  onReject={async () => {
                    "use server";
                    await setOfferStatus(offer.id, "rejected");
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
