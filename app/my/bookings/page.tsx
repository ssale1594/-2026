import Link from "next/link";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import PageHeader from "@/components/page-header";
import BookingActions from "@/app/dashboard/bookings/booking-actions-client";
import { BOOKING_STATUS, bookingWhen, isUpcoming } from "@/lib/bookings";

export const metadata = { title: pageTitle("مواعيدي") };

type Row = {
  id: number;
  booking_date: string;
  start_minute: number;
  duration_minutes: number;
  status: string;
  service_title: string | null;
  quoted_price_sar: number | null;
  notes: string | null;
  cancel_reason: string | null;
  deal_id: number | null;
  sellers: { business_name: string | null; slug: string | null } | null;
};

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>;
}) {
  const user = await requireUser();
  const { booked } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("seller_bookings")
    .select(
      "id, booking_date, start_minute, duration_minutes, status, service_title, " +
        "quoted_price_sar, notes, cancel_reason, deal_id, " +
        "sellers:sellers!seller_bookings_seller_id_fkey(business_name, slug)"
    )
    .eq("buyer_id", user.id)
    .order("booking_date", { ascending: false })
    .order("start_minute", { ascending: false })
    .limit(100);

  const rows = ((data as any[]) ?? []) as Row[];
  const upcoming = rows.filter((r) => isUpcoming(r.booking_date, r.status));
  const past = rows.filter((r) => !isUpcoming(r.booking_date, r.status));

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold shrink-0">
            {siteName}
          </Link>
          <Link
            href="/notifications"
            className="text-sm text-black/60 dark:text-white/60 hover:underline"
          >
            الإشعارات
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="📅 مواعيدي"
          subtitle="الحجوزات اللي طلبتها من الباعة، وحالة كل واحد منها."
          breadcrumb={[
            { label: "الرئيسية", href: "/" },
            { label: "مواعيدي" },
          ]}
        />

        <div className="px-4 pb-10">
          {booked === "1" && (
            <div className="mb-6 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm">
              وصل طلب حجزك للبائع. بيوصلك إشعار أول ما يؤكده.
            </div>
          )}

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.25] p-10 text-center">
              <div className="text-4xl mb-3">📅</div>
              <p className="font-medium mb-1">ما حجزت أي موعد بعد</p>
              <p className="text-sm text-black/60 dark:text-white/60 mb-4">
                الباعة اللي يقبلون الحجز يظهر بصفحاتهم زر «احجز موعد».
              </p>
              <Link
                href="/search"
                className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 inline-block"
              >
                تصفّح الباعة
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              <Section title="القادمة" rows={upcoming} empty="ما فيه مواعيد قادمة." />
              <Section title="السابقة" rows={past} empty="ما فيه سجل بعد." />
            </div>
          )}
        </div>
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
  rows: Row[];
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
                      {r.sellers?.business_name && (
                        <>
                          {" — "}
                          {r.sellers.slug ? (
                            <Link
                              href={`/seller/${r.sellers.slug}`}
                              className="hover:underline"
                            >
                              {r.sellers.business_name}
                            </Link>
                          ) : (
                            r.sellers.business_name
                          )}
                        </>
                      )}
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

                {r.quoted_price_sar != null && (
                  <div className="text-sm mb-1">
                    <span className="text-black/50 dark:text-white/50">
                      السعر:{" "}
                    </span>
                    {r.quoted_price_sar} ر.س
                  </div>
                )}
                {r.cancel_reason && (
                  <div className="text-sm text-red-700 dark:text-red-300 mb-1">
                    سبب الإلغاء: {r.cancel_reason}
                  </div>
                )}
                {r.deal_id && (
                  <Link
                    href="/my/deals"
                    className="text-sm text-sky-700 dark:text-sky-300 hover:underline block mb-2"
                  >
                    صفقة #{r.deal_id} ←
                  </Link>
                )}

                <BookingActions bookingId={r.id} status={r.status} as="buyer" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
