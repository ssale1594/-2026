import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import DealsClient from "@/app/deals/deals-client";
import Link from "next/link";
import { siteName } from "@/lib/seo";

export const metadata = {
  title: `صفقاتي - ${siteName}`,
  description: "عرض كافة الصفقات التي أرسلتها كعميل، حالة كل صفقة، والإجراءات المتاحة.",
};

export default async function MyDealsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from("deals")
    .select(
      `id, title, description, status, price_agreed_sar, deadline_date, ` +
        `created_at, accepted_at, completed_at, disputed_at, rejected_at, cancelled_at, ` +
        `rejected_reason, dispute_reason, cancelled_reason, delivery_notes, ` +
        `listing_id, seller_id, ` +
        `sellers:profiles!deals_seller_id_fkey(business_name, slug, trust_level, verification_status), ` +
        `buyers:profiles!deals_buyer_id_fkey(id, business_name, display_name), ` +
        `listings(title, slug, price, categories(name_ar))`
    )
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const dealIds = ((deals as any[]) ?? []).map((d) => d.id);
  let payments: any[] = [];
  if (dealIds.length) {
    const p = await supabase
      .from("deal_payments")
      .select(
        `id, deal_id, submitted_by, paid_by_buyer, payment_method, amount_sar, ` +
          `reference_number, bank_name, transfer_date, payer_account_last4, ` +
          `proof_storage_path, proof_mime_type, proof_filename, proof_size_bytes, ` +
          `notes, status, verified_at, verification_notes, created_at, ` +
          `submitter:profiles!deal_payments_submitted_by_fkey(id, full_name)`
      )
      .in("deal_id", dealIds)
      .order("created_at", { ascending: true });
    payments = (p.data as any[]) ?? [];
  }
  const paymentsByDeal: Record<number, any[]> = {};
  for (const pp of payments) {
    (paymentsByDeal[pp.deal_id] = paymentsByDeal[pp.deal_id] ?? []).push(pp);
  }

  // Redirect seller-only tab
  const { data: isSellerRow } = await supabase
    .from("sellers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  const sellerTab = !!isSellerRow;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-black dark:text-white">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <nav className="text-xs text-black/50 dark:text-white/50 mb-3">
            <Link href="/" className="hover:underline">
              الرئيسية
            </Link>{" "}
            / <b>صفقاتي كعميل</b>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold inline-flex items-center gap-3">
                🛒 صفقاتي
              </h1>
              <p className="text-sm text-black/60 dark:text-white/60 mt-2 max-w-2xl">
                كل الصفقات التي أرسلتها إلى الباعة. تتبع حالتها، أكد استلامك،
                أو اطلب تدخل الإدارة إذا حدث خلاف.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {sellerTab && (
                <Link
                  href="/dashboard/deals"
                  className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 font-semibold"
                >
                  عرض صفقاتي كبائع →
                </Link>
              )}
              <Link
                href="/"
                className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 font-semibold shadow"
              >
                تابع التسوق
              </Link>
            </div>
          </div>
        </header>

        <DealsClient
          role="buyer"
          deals={deals ?? []}
          userId={user.id}
          paymentsByDeal={paymentsByDeal}
        />
      </main>
    </div>
  );
}

const _ = redirect; // silence unused
