import { createClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth/permissions";
import DealsClient from "@/app/deals/deals-client";
import Link from "next/link";
import { siteName } from "@/lib/seo";

export const metadata = {
  title: `إدارة الصفقات - لوحة التحكم - ${siteName}`,
  description: "إدارة الصفقات الواردة من العملاء، قبول أو رفض، وإنهاء الصفقات لتحتسب كمعاملات ناجحة.",
};

export default async function DashboardDealsPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from("deals")
    .select(
      `id, title, description, status, price_agreed_sar, deadline_date, ` +
        `created_at, accepted_at, completed_at, disputed_at, rejected_at, cancelled_at, ` +
        `rejected_reason, dispute_reason, cancelled_reason, delivery_notes, ` +
        `listing_id, ` +
        `sellers:profiles!deals_seller_id_fkey(business_name, slug), ` +
        `buyers:profiles!deals_buyer_id_fkey(id, business_name, display_name, email, phone), ` +
        `listings(title, slug, price, categories(name_ar))`
    )
    .eq("seller_id", seller.id)
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

  // إحصائيات البائع (كما في شارة المعاملات)
  const { data: statsRow } = await (supabase.rpc as any)("seller_completed_deals", {
    p_seller_id: seller.id,
  });
  const stats = (statsRow as any[])?.[0] ?? {
    completed_count: 0,
    total_revenue_sar: 0,
    in_progress_count: 0,
    disputed_count: 0,
    last30d_completed: 0,
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-black dark:text-white">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <nav className="text-xs text-black/50 dark:text-white/50 mb-3">
            <Link href="/" className="hover:underline">الرئيسية</Link> /{" "}
            <Link href="/dashboard" className="hover:underline">لوحة التحكم</Link> /{" "}
            <b>إدارة الصفقات</b>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold inline-flex items-center gap-3">
                🤝 إدارة صفقات البائع
              </h1>
              <p className="text-sm text-black/60 dark:text-white/60 mt-2 max-w-2xl">
                رد على طلبات الصفقات من العملاء. الصفقات المكتملة تُحتسب في
                شارة "المعاملات الناجحة" في ملفك العام وتُعزز ثقة المشترين.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/my/deals"
                className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 font-semibold"
              >
                صفقاتي كعميل
              </Link>
              <Link
                href={`/seller/${seller.slug}`}
                className="text-sm rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700 font-semibold shadow"
              >
                معاينة ملفك العام ←
              </Link>
            </div>
          </div>
        </header>

        {/* KPI: شارة المعاملات (تظهر للبائع حتى لو كان صفراً) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-neutral-900 p-4">
            <div className="text-xs opacity-70 mb-1">🏆 المعاملات الناجحة</div>
            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {Number(stats.completed_count).toLocaleString("ar-SA")}
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
              منها {Number(stats.last30d_completed).toLocaleString("ar-SA")} خلال 30 يوم
            </div>
          </div>
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-white/60 dark:bg-neutral-900/60 p-4">
            <div className="text-xs opacity-70 mb-1">💰 إجمالي المبالغ المغلقة</div>
            <div className="text-2xl font-extrabold">
              {Number(stats.total_revenue_sar || 0).toLocaleString("ar-SA", {
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-sm opacity-60">ر.س</span>
            </div>
          </div>
          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-neutral-900 p-4">
            <div className="text-xs opacity-70 mb-1">⚡ قيد التنفيذ حالياً</div>
            <div className="text-2xl font-extrabold text-sky-700 dark:text-sky-300">
              {Number(stats.in_progress_count).toLocaleString("ar-SA")}
            </div>
          </div>
          <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-50 to-white dark:from-fuchsia-950/40 dark:to-neutral-900 p-4">
            <div className="text-xs opacity-70 mb-1">⚠️ خصوم بانتظار الإدارة</div>
            <div className="text-2xl font-extrabold text-fuchsia-700 dark:text-fuchsia-300">
              {Number(stats.disputed_count).toLocaleString("ar-SA")}
            </div>
          </div>
        </section>

        <DealsClient
          role="seller"
          deals={deals ?? []}
          userId={seller.id}
          paymentsByDeal={paymentsByDeal}
        />
      </main>
    </div>
  );
}
