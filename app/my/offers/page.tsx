import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { listingImageUrl } from "@/lib/storage";
import BidActions from "@/app/dashboard/bids/bid-actions";
import PageHeader from "@/components/page-header";
import Link from "next/link";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ بانتظار البائع", cls: "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300/50" },
  countered: { label: "🔄 عرض مضاد من البائع", cls: "bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-sky-300/50" },
  accepted: { label: "🎉 وافق البائع!", cls: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300/50" },
  rejected: { label: "❌ رفض البائع", cls: "bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-300/50" },
  expired: { label: "⌛ انتهت الصلاحية", cls: "bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300" },
  cancelled: { label: "🚫 ألغيته", cls: "bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300" },
  deal_created: { label: "🤝 تحول لصفقة", cls: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300/50" },
};

function fmt(n: any) {
  const v = Number(n);
  if (!v) return "—";
  return v.toLocaleString("ar-SA");
}

export default async function MyOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const sp = await searchParams;
  const filter = sp.filter && Object.keys(STATUS).includes(sp.filter) ? sp.filter : "all";

  const offersQ = await supabase
    .from("listing_offers")
    .select(
      "id, status, offer_price_sar, counter_price_sar, message, counter_message, valid_until, counter_valid_until, created_at, deal_id," +
        "seller:seller_id(id, business_name, slug, profiles_meta!inner(avatar_url)), " +
        "listing:listings(id, title, slug, price, listing_images(storage_path, is_primary))"
    )
    .eq("offerer_id", user.id)
    .order("created_at", { ascending: false });
  const offers = ((offersQ.data as any[]) ?? []).filter(
    (o) => filter === "all" || o.status === filter
  );

  const tabs: { k: string; label: string }[] = [
    { k: "all", label: "الكل" },
    { k: "pending", label: "⏳ قيد الانتظار" },
    { k: "countered", label: "🔄 عروض مضادة عليّ" },
    { k: "accepted", label: "🎉 مقبولة" },
    { k: "deal_created", label: "🤝 صفقات" },
    { k: "rejected", label: "❌ مرفوضة" },
    { k: "expired", label: "⌛ منتهية" },
    { k: "cancelled", label: "🚫 ملغاة" },
  ];

  const active = "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white";
  const norm = "bg-white/60 border-black/10 text-black/70 hover:bg-white dark:bg-white/5 dark:border-white/15 dark:text-white/70";
  const baseCls = "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border";

  const stats = {
    pending: offers.filter((o) => o.status === "pending").length,
    countered: offers.filter((o) => o.status === "countered").length,
    accepted: offers.filter((o) => ["accepted", "deal_created"].includes(o.status)).length,
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="💰 عروضي المالية"
        subtitle={`تقدمت بـ ${offers.length} عرض حتى الآن — ${stats.pending} قيد النظر · ${stats.countered} عروض مضادة في انتظار ردك · ${stats.accepted} تحولت لصفقات أو وافق عليها البائع.`}
        breadcrumb={[
          { label: "الرئيسية", href: "/" },
          { label: "حسابي", href: "/my" },
          { label: "عروضي المالية" },
        ]}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <a
            key={t.k}
            href={t.k === "all" ? "/my/offers" : `/my/offers?filter=${t.k}`}
            className={`${baseCls} ${filter === t.k ? active : norm}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {offers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/15 dark:border-white/20 p-12 text-center">
          <div className="text-5xl mb-3">💭</div>
          <h3 className="font-bold mb-1">لم تقدّم أي عرض بعد.</h3>
          <p className="opacity-60 text-sm mb-4">
            تصفح الإعلانات واضغط زر <b>💰 أقدم عرض سعر</b> على الإعلان الذي يعجبك
            لتبدأ مفاوضة فورية مع البائع.
          </p>
          <Link
            href="/"
            className="inline-flex rounded-full bg-black dark:bg-white text-white dark:text-black font-bold px-5 py-2"
          >
            تصفح الإعلانات
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((o: any) => {
            const s = STATUS[o.status] ?? STATUS.pending;
            const sellerName = o.seller?.business_name || `بائع #${o.seller?.id?.slice(0, 6) ?? "000000"}`;
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-black/[.08] dark:border-white/[.14] bg-white dark:bg-neutral-900 shadow-sm p-5"
              >
                <div className="flex flex-col lg:flex-row gap-5">
                  <a
                    href={o.listing?.slug ? `/listing/${o.listing.slug}` : "#"}
                    className="shrink-0 lg:w-24 w-full flex lg:flex-col flex-row gap-3 items-start"
                  >
                    <img
                      src={
                        // listings ما فيه main_image_url — الصور في جدول
                        // listing_images منفصل، والأساسية هي is_primary.
                        listingThumb(o.listing) ??
                        "data:image/svg+xml;utf8," + encodeURIComponent(
                          `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='128' height='128' fill='%23eee'/><text x='50%' y='50%' font-size='32' fill='%23999' text-anchor='middle' dy='.3em'>?</text></svg>`
                        )
                      }
                      className="w-full aspect-square object-cover rounded-xl border border-black/5 dark:border-white/10"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm line-clamp-2">
                        {o.listing?.title ?? "إعلان محذوف"}
                      </div>
                      {o.listing?.price != null && (
                        <div className="text-xs opacity-60 mt-0.5">
                          سعر الإعلان: {fmt(o.listing.price)} ر.س
                        </div>
                      )}
                    </div>
                  </a>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="font-extrabold text-2xl text-fuchsia-700 dark:text-fuchsia-300">
                        عرضي: {fmt(o.offer_price_sar)} ر.س
                      </div>
                      {o.counter_price_sar != null && (
                        <div className="font-extrabold text-lg text-sky-700 dark:text-sky-300">
                          ↔️ البائع يقترح: {fmt(o.counter_price_sar)} ر.س
                        </div>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${s.cls}`}>
                        {s.label}
                      </span>
                      {o.deal_id && (
                        <a
                          href={`/my/deals?focus=${o.deal_id}`}
                          className="rounded-full bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 hover:bg-indigo-700"
                        >
                          فتح الصفقة #{o.deal_id} →
                        </a>
                      )}
                    </div>

                    <div className="text-xs opacity-70 mb-2 inline-flex items-center gap-2">
                      🏪 {o.seller?.slug ? (
                        <Link href={`/seller/${o.seller.slug}`} className="hover:underline">{sellerName}</Link>
                      ) : (
                        sellerName
                      )}
                      {" · "}
                      📅 {new Date(o.created_at).toLocaleString("ar-SA")}
                    </div>

                    {o.message && (
                      <div className="rounded-xl bg-black/[.03] dark:bg-white/[.05] px-3 py-2 text-sm mb-2">
                        <span className="opacity-60 text-[11px] font-bold">رسالتي:</span>
                        <div className="mt-1">{o.message}</div>
                      </div>
                    )}
                    {o.counter_message && (
                      <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2 text-sm mb-2">
                        <span className="opacity-70 text-[11px] font-bold">ملاحظة البائع:</span>
                        <div className="mt-1">{o.counter_message}</div>
                      </div>
                    )}

                    {/* buyer-side actions (rendered via same component) */}
                    <BidActions
                      offerId={o.id}
                      status={o.status}
                      currentOffer={Number(o.offer_price_sar)}
                      counterPrice={o.counter_price_sar ? Number(o.counter_price_sar) : null}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function listingThumb(listing: any): string | undefined {
  const imgs = listing?.listing_images as
    | { storage_path: string; is_primary?: boolean }[]
    | undefined;
  if (!imgs?.length) return undefined;
  const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
  return listingImageUrl(primary.storage_path);
}
