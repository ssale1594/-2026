import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle } from "@/lib/seo";
import DashboardHeader from "@/app/dashboard/dashboard-header";
import BookingActions from "./booking-actions-client";
import { BOOKING_STATUS, bookingWhen, isUpcoming } from "@/lib/bookings";

export const metadata = { title: pageTitle("حجوزاتي") };

type BookingRow = {
  id: number;
  booking_date: string;
  start_minute: number;
  duration_minutes: number;
  status: string;
  service_title: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  quoted_price_sar: number | null;
  notes: string | null;
  cancel_reason: string | null;
  deal_id: number | null;
  buyers: { full_name: string | null } | null;
};

export default async function SellerBookingsPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { data } = await supabase
    .from("seller_bookings")
    .select(
      "id, booking_date, start_minute, duration_minutes, status, service_title, " +
        "customer_name, customer_phone, quoted_price_sar, notes, cancel_reason, deal_id, " +
        "buyers:profiles!seller_bookings_buyer_id_fkey(full_name)"
    )
    .eq("seller_id", seller.id)
    .order("booking_date", { ascending: false })
    .order("start_minute", { ascending: false })
    .limit(200);

  const rows = ((data as any[]) ?? []) as BookingRow[];
  const upcoming = rows.filter((r) => isUpcoming(r.booking_date, r.status));
  const past = rows.filter((r) => !isUpcoming(r.booking_date, r.status));
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader
        sellerName={seller.business_name}
        title="📅 طلبات الحجز"
        subtitle={
          pendingCount > 0
            ? `${pendingCount} طلب ينتظر ردّك.`
            : "ما فيه طلبات معلّقة."
        }
        breadcrumb={[
          { label: "الرئيسية", href: "/" },
          { label: "لوحة البائع", href: "/dashboard" },
          { label: "طلبات الحجز" },
        ]}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/dashboard/schedule"
            className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            🗓️ عدّل دوامك
          </Link>
          <Link
            href={`/booking/${seller.slug}`}
            className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            صفحة الحجز العامة ←
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.25] p-10 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="font-medium mb-1">ما وصلك طلب حجز بعد</p>
            <p className="text-sm text-black/60 dark:text-white/60">
              تأكد إن دوامك محدّد، وشارك رابط صفحة الحجز مع عملائك.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <Section
              title="القادمة"
              rows={upcoming}
              empty="ما فيه مواعيد قادمة."
            />
            <Section title="السابقة" rows={past} empty="ما فيه سجل بعد." />
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: BookingRow[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">
        {title}{" "}
        <span className="text-black/40 dark:text-white/40">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const st = BOOKING_STATUS[r.status] ?? {
              label: r.status,
              cls: "border-black/20",
            };
            return (
              <li
                key={r.id}
                id={`booking-${r.id}`}
                className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-medium">
                      {r.service_title || "حجز خدمة"}
                    </div>
                    <div className="text-sm text-black/60 dark:text-white/60 tabular-nums">
                      {bookingWhen(
                        r.booking_date,
                        r.start_minute,
                        r.duration_minutes
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs rounded-full border px-2.5 py-1 ${st.cls}`}
                  >
                    {st.label}
                  </span>
                </div>

                <div className="text-sm space-y-1 mb-3">
                  <div>
                    <span className="text-black/50 dark:text-white/50">
                      العميل:{" "}
                    </span>
                    {r.customer_name || r.buyers?.full_name || "—"}
                    {r.customer_phone && (
                      <>
                        {" · "}
                        <a
                          href={`https://wa.me/${r.customer_phone.replace(
                            /\D/g,
                            ""
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {r.customer_phone}
                        </a>
                      </>
                    )}
                  </div>
                  {r.quoted_price_sar != null && (
                    <div>
                      <span className="text-black/50 dark:text-white/50">
                        السعر:{" "}
                      </span>
                      {r.quoted_price_sar} ر.س
                    </div>
                  )}
                  {r.notes && (
                    <div className="text-black/70 dark:text-white/70">
                      «{r.notes}»
                    </div>
                  )}
                  {r.cancel_reason && (
                    <div className="text-red-700 dark:text-red-300">
                      سبب الإلغاء: {r.cancel_reason}
                    </div>
                  )}
                  {r.deal_id && (
                    <Link
                      href="/dashboard/deals"
                      className="text-sky-700 dark:text-sky-300 hover:underline"
                    >
                      صفقة #{r.deal_id} أُنشئت تلقائيًا ←
                    </Link>
                  )}
                </div>

                <BookingActions bookingId={r.id} status={r.status} as="seller" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
