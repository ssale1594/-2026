import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import ReviewForm from "./review-form";

export const metadata: Metadata = {
  title: pageTitle("تعاملاتي"),
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  claimed: "بانتظار تأكيد البائع",
  confirmed: "مؤكد",
  disputed: "البائع ما أكّد التعامل",
};

export default async function MyTransactionsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: transactions }, { data: myReviews }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, status, created_at, seller_id, sellers(business_name, slug), listings(title, slug)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .returns<
        {
          id: number;
          status: string;
          created_at: string;
          seller_id: string;
          sellers: { business_name: string; slug: string } | null;
          listings: { title: string; slug: string } | null;
        }[]
      >(),
    supabase.from("reviews").select("transaction_id").eq("buyer_id", user.id),
  ]);

  const reviewedIds = new Set((myReviews ?? []).map((row) => row.transaction_id));

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">تعاملاتي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          التقييم يفتح بعد ما يأكد البائع التعامل — عشان يكون كل تقييم موثق من
          الطرفين.
        </p>

        {!transactions || transactions.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما سجلت أي تعامل بعد. من صفحة أي إعلان، اضغط &quot;تعاملت مع هذا
            البائع&quot;.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {transactions.map((transaction) => (
              <li
                key={transaction.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <div className="font-medium">
                  {transaction.sellers?.business_name ?? "بائع محذوف"}
                </div>
                {transaction.listings && (
                  <Link
                    href={`/listing/${transaction.listings.slug}`}
                    className="text-sm text-black/60 dark:text-white/60 hover:underline"
                  >
                    {transaction.listings.title}
                  </Link>
                )}
                <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                  {STATUS_LABELS[transaction.status]} ·{" "}
                  {relativeTimeAr(transaction.created_at)}
                </div>

                {transaction.status === "confirmed" &&
                  (reviewedIds.has(transaction.id) ? (
                    <p className="text-sm text-black/50 dark:text-white/50 mt-3">
                      قيّمت هذا التعامل.
                    </p>
                  ) : (
                    <ReviewForm
                      transactionId={transaction.id}
                      sellerId={transaction.seller_id}
                    />
                  ))}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
