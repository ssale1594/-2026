import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle } from "@/lib/seo";
import DashboardHeader from "@/app/dashboard/dashboard-header";
import ScheduleForm from "./schedule-form";
import { rowsFromDb } from "@/lib/schedule";

export const metadata = { title: pageTitle("دوام الحجوزات") };

export default async function SchedulePage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { data: saved } = await supabase
    .from("seller_availability")
    .select(
      "day_of_week, start_minute, end_minute, is_closed, slot_duration_minutes, buffer_minutes, max_parallel_bookings"
    )
    .eq("seller_id", seller.id);

  const rows = rowsFromDb((saved as any[]) ?? []);
  const anyOpen = rows.some((r) => r.enabled);

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader
        sellerName={seller.business_name}
        title="🗓️ دوام الحجوزات"
        subtitle="ساعات عملك الأسبوعية — منها تُحسب المواعيد المتاحة للحجز."
        breadcrumb={[
          { label: "الرئيسية", href: "/" },
          { label: "لوحة البائع", href: "/dashboard" },
          { label: "دوام الحجوزات" },
        ]}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {anyOpen ? (
          <div className="mb-6 rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              صفحة الحجز لديك جاهزة — شاركها مع عملائك.
            </div>
            <Link
              href={`/booking/${seller.slug}`}
              className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
            >
              معاينة صفحة الحجز ←
            </Link>
          </div>
        ) : (
          <div className="mb-6 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm">
            ما فيه أي يوم مفتوح بعد، فصفحة الحجز تظهر فاضية للعملاء. فعّل يومًا
            واحدًا على الأقل.
          </div>
        )}

        <ScheduleForm initial={rows} />

        <div className="mt-8 text-sm text-black/60 dark:text-white/60 space-y-1">
          <p>
            <b>مدة الموعد</b> تقسم ساعات دوامك إلى فترات — ٦٠ دقيقة تعني موعدًا
            كل ساعة.
          </p>
          <p>
            <b>الفاصل</b> وقت بين موعدين للتنقّل أو التجهيز، ما يظهر للحجز.
          </p>
          <p>
            <b>المواعيد المتزامنة</b> كم عميل تقدر تستقبل بنفس الوقت — خلّها ١ لو
            تشتغل وحدك.
          </p>
        </div>
      </main>
    </div>
  );
}
