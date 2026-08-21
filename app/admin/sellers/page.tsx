import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import { setSellerVerification } from "../actions";
import ReviewButtons from "../review-buttons";

export default async function AdminSellersPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: sellers } = await supabase
    .from("sellers")
    .select("id, business_name, business_type, description, whatsapp_number, created_at")
    .eq("verification_status", "pending")
    .order("created_at");

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="sellers" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">بائعون بانتظار المراجعة</h1>

        {!sellers || sellers.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه طلبات جديدة.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sellers.map((seller) => (
              <li
                key={seller.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{seller.business_name}</div>
                  <div className="text-sm text-black/60 dark:text-white/60 mt-1">
                    {seller.whatsapp_number}
                  </div>
                  {seller.description && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {seller.description}
                    </p>
                  )}
                </div>
                <ReviewButtons
                  onApprove={setSellerVerification.bind(null, seller.id, "approved")}
                  onReject={setSellerVerification.bind(null, seller.id, "rejected")}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
