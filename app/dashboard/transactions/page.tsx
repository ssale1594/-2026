import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { relativeTimeAr } from "@/lib/relative-time";
import DashboardHeader from "../dashboard-header";
import ReviewButtons from "../../admin/review-buttons";
import { setTransactionStatus } from "./actions";

export default async function SellerTransactionsPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, status, created_at, listings(title, slug)")
    .eq("seller_id", seller.id)
    .eq("status", "claimed")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: number;
        status: string;
        created_at: string;
        listings: { title: string; slug: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">تعاملات بانتظار تأكيدك</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          عملاء يقولون إنهم تعاملوا معك. تأكيدك يفتح لهم إمكانية تقييمك — وهذا
          اللي يخلي التقييمات موثوقة.
        </p>

        {!transactions || transactions.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه تعاملات بانتظار التأكيد.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {transactions.map((transaction) => (
              <li
                key={transaction.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">
                    {transaction.listings?.title ?? "إعلان محذوف"}
                  </div>
                  <div className="text-xs text-black/40 dark:text-white/40 mt-1">
                    {relativeTimeAr(transaction.created_at)}
                  </div>
                </div>
                <ReviewButtons
                  approveLabel="أكّد"
                  rejectLabel="ما تعاملت معه"
                  onApprove={async () => {
                    "use server";
                    await setTransactionStatus(transaction.id, "confirmed");
                  }}
                  onReject={async () => {
                    "use server";
                    await setTransactionStatus(transaction.id, "disputed");
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
