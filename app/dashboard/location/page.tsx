import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle } from "@/lib/seo";
import DashboardHeader from "@/app/dashboard/dashboard-header";
import LocationForm from "./location-form";

export const metadata = { title: pageTitle("موقع المحل") };

type SellerLocation = {
  latitude: number | null;
  longitude: number | null;
  address_note: string | null;
  phone: string | null;
  neighborhood_id: number | null;
};

export default async function LocationPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const [locationQ, hoodsQ, clicksQ] = await Promise.all([
    supabase
      .from("sellers")
      .select("latitude, longitude, address_note, phone, neighborhood_id")
      .eq("id", seller.id)
      .single<SellerLocation>(),
    supabase.from("neighborhoods").select("id, name_ar").order("name_ar"),
    supabase.rpc("seller_contact_summary", { p_days: 30 }),
  ]);

  const location: SellerLocation = locationQ.data ?? {
    latitude: null,
    longitude: null,
    address_note: null,
    phone: null,
    neighborhood_id: null,
  };

  const clicks = (clicksQ.data ?? []) as { channel: string; clicks: number }[];
  const onMap = location.latitude !== null && location.longitude !== null;

  const CHANNEL_LABEL: Record<string, string> = {
    whatsapp: "واتساب",
    phone: "اتصال",
    directions: "طلب اتجاهات",
    profile: "زيارة الصفحة",
  };

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader
        sellerName={seller.business_name}
        title="📍 موقع المحل"
        subtitle="حدّد موقعك مرة واحدة، وخلّي الزبون يوصلك بضغطة."
        breadcrumb={[
          { label: "الرئيسية", href: "/" },
          { label: "لوحة البائع", href: "/dashboard" },
          { label: "موقع المحل" },
        ]}
      />

      <main className="mx-auto max-w-2xl px-4 py-8">
        {onMap ? (
          <div className="mb-6 rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">
              محلك يظهر على دليل الخريطة ✅
            </span>
            <Link
              href="/map"
              className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
            >
              شوف الدليل ←
            </Link>
          </div>
        ) : (
          <div className="mb-6 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm">
            ما حدّدت موقعك بعد، فما تظهر على دليل الخريطة. تحديده يأخذ دقيقة
            واحدة.
          </div>
        )}

        <LocationForm
          initial={location}
          neighborhoods={(hoodsQ.data ?? []) as { id: number; name_ar: string }[]}
        />

        {clicks.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold mb-3">
              تواصل مباشر معك — آخر 30 يوم
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {clicks.map((row) => (
                <div
                  key={row.channel}
                  className="rounded-lg border border-black/[.08] dark:border-white/[.145] px-3 py-3 text-center"
                >
                  <div className="text-xl font-extrabold">{row.clicks}</div>
                  <div className="text-xs text-black/55 dark:text-white/55 mt-0.5">
                    {CHANNEL_LABEL[row.channel] ?? row.channel}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
