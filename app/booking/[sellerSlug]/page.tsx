import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import BookingCalendar, { type Slot } from "./booking-calendar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sellerSlug: string }>;
}): Promise<Metadata> {
  const { sellerSlug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sellers")
    .select("business_name")
    .eq("slug", sellerSlug)
    .maybeSingle();
  const name = (data as any)?.business_name;
  return {
    title: pageTitle(name ? `احجز موعد مع ${name}` : "حجز موعد"),
    description: name
      ? `احجز موعدًا مع ${name} في الزلفي — اختر اليوم والوقت المتاح.`
      : undefined,
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ sellerSlug: string }>;
}) {
  const { sellerSlug } = await params;
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("sellers")
    .select("id, business_name, slug, verification_status, whatsapp_number")
    .eq("slug", sellerSlug)
    .maybeSingle();

  if (!seller || (seller as any).verification_status !== "approved") {
    notFound();
  }
  const s = seller as any;

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: { user } }, slotsQ] = await Promise.all([
    supabase.auth.getUser(),
    (supabase.rpc as any)("seller_free_slots", {
      p_seller_id: s.id,
      p_start_date: today,
      p_days: 14,
    }),
  ]);

  const slots = ((slotsQ?.data as Slot[]) ?? []).map((x) => ({
    ...x,
    slot_date: String(x.slot_date).slice(0, 10),
  }));

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold shrink-0">
            {siteName}
          </Link>
          <Link
            href={`/seller/${s.slug}`}
            className="text-sm text-black/60 dark:text-white/60 hover:underline"
          >
            صفحة {s.business_name} ←
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">احجز موعد مع {s.business_name}</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-8">
          اختر يومًا ووقتًا من المتاح، وبيوصل البائع طلبك للتأكيد.
        </p>

        <BookingCalendar
          sellerId={s.id}
          sellerName={s.business_name}
          slots={slots}
          isSignedIn={Boolean(user)}
          loginHref={`/login?next=${encodeURIComponent(`/booking/${s.slug}`)}`}
        />
      </main>
    </div>
  );
}
