import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { listingImageUrl } from "@/lib/storage";
import DashboardHeader from "@/app/dashboard/dashboard-header";
import BidActions from "./bid-actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ انتظار ردك", cls: "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300/50" },
  countered: { label: "🔄 عرض مضاد منك", cls: "bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-sky-300/50" },
  accepted: { label: "✅ قُبل العرض", cls: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300/50" },
  rejected: { label: "❌ رفض", cls: "bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-300/50" },
  expired: { label: "⌛ انتهت الصلاحية", cls: "bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300" },
  cancelled: { label: "🚫 ألغاه المشتري", cls: "bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300" },
  deal_created: { label: "🤝 تحول لصفقة", cls: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300/50" },
};

function fmt(n: any) {
  const v = Number(n);
  if (!v) return "—";
  return v.toLocaleString("ar-SA");
}
function hoursLeft(dateStr: any, counter?: any) {
  if (!dateStr) return null;
  const base = counter ?? dateStr;
  const secs = Math.floor((new Date(base).getTime() - Date.now()) / 1000);
  if (secs <= 0) return "انتهت صلاحيته";
  if (secs < 60 * 60) return `باقي ${Math.floor(secs / 60)} دقيقة`;
  const h = Math.floor(secs / 3600);
  if (h < 24) return `باقي ${h} ساعة`;
  return `باقي ${Math.floor(h / 24)} يوم و${h % 24} ساعة`;
}

export default async function DashboardBidsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const seller = await requireSeller();
  const supabase = await createClient();
  const sp = await searchParams;
  const filter = sp.filter && ["pending", "countered", "accepted", "rejected", "expired", "deal_created"].includes(sp.filter) ? sp.filter : "all";

  const [summQ, offersQ] = await Promise.all([
    (supabase.rpc as any)("seller_offers_summary", { p_seller_id: seller.id }).maybeSingle(),
    supabase
      .from("listing_offers")
      .select(
        "id, status, offer_price_sar, counter_price_sar, message, counter_message, " +
          "valid_until, counter_valid_until, created_at, countered_at, deal_id, " +
          "offerer:offerer_id(id, full_name, phone, profiles_meta!inner(avatar_url)), " +
          "listing:listings(id, title, slug, price, listing_images(storage_path, is_primary))"
      )
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false }),
  ]);

  const offers = ((offersQ.data as any[]) ?? []).filter(
    (o: any) => filter === "all" || o.status === filter
  );
  const summary = summQ.data as any ?? {};

  const baseCls =
    "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border";
  const active = "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white";
  const norm = "bg-white/60 border-black/10 text-black/70 hover:bg-white dark:bg-white/5 dark:border-white/15 dark:text-white/70";

  const tabs: { k: string; label: string }[] = [
    { k: "all", label: "الكل" },
    { k: "pending", label: `⏳ انتظار ردك (${summary.pending_count ?? 0})` },
    { k: "countered", label: `🔄 عروض مضادة (${summary.countered_count ?? 0})` },
    { k: "accepted", label: `✅ مقبولة (${summary.accepted_count ?? 0})` },
    { k: "deal_created", label: "🤝 صفقات منشأة" },
    { k: "rejected", label: "❌ مرفوضة" },
    { k: "expired", label: "⌛ منتهية" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <DashboardHeader
        title="🧾 العروض المالية على إعلاناتي"
        subtitle={`${summary.total_received ?? 0} عرض استلمناه حتى الآن · ${summary.today_received ?? 0} خلال 24 ساعة الماضية`}
        breadcrumb={[
          { label: "الرئيسية", href: "/" },
          { label: "لوحة البائع", href: "/dashboard" },
          { label: "العروض المالية" },
        ]}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <a
            key={t.k}
            href={t.k === "all" ? "/dashboard/bids" : `/dashboard/bids?filter=${t.k}`}
            className={`${baseCls} ${filter === t.k ? active : norm}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {offers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/15 dark:border-white/20 p-12 text-center">
          <div className="text-5xl mb-3 opacity-70">💬</div>
          <h3 className="font-bold mb-1">لا توجد عروض هنا بعد.</h3>
          <p className="opacity-60 text-sm">
            ما زال أي مستخدم يقدم عرضاً مالياً على أحد إعلاناتك. لما يجيء العرض
            يظهر هنا مباشرة مع خيارات القبول والرفض والعرض المضاد.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((o: any) => {
            const s = STATUS[o.status] ?? STATUS.pending;
            const offererName = o.offerer?.full_name || `مشتري #${o.offerer?.id?.slice(0, 6) ?? "000000"}`;
            const ttl =
              o.status === "countered"
                ? hoursLeft(o.valid_until, o.counter_valid_until)
                : ["pending"].includes(o.status)
                  ? hoursLeft(o.valid_until)
                  : null;
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
                      <div className="font-bold text-sm line-clamp-2">{o.listing?.title ?? "إعلان محذوف"}</div>
                      {o.listing?.price != null && (
                        <div className="text-xs opacity-60 mt-0.5">
                          السعر المعلن: {fmt(o.listing.price)} ر.س
                        </div>
                      )}
                    </div>
                  </a>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="font-extrabold text-2xl text-fuchsia-700 dark:text-fuchsia-300">
                        {fmt(o.offer_price_sar)} ر.س
                      </div>
                      {o.counter_price_sar != null && (
                        <div className="font-bold text-lg text-sky-700 dark:text-sky-300">
                          ↔️ عرضك المضاد: {fmt(o.counter_price_sar)} ر.س
                        </div>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${s.cls}`}>
                        {s.label}
                      </span>
                      {ttl && <span className="text-xs opacity-60">{ttl}</span>}
                      {o.deal_id && (
                        <a
                          href={`/dashboard/deals?focus=${o.deal_id}`}
                          className="rounded-full bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 hover:bg-indigo-700"
                        >
                          فتح الصفقة #{o.deal_id} →
                        </a>
                      )}
                    </div>

                    <div className="text-xs opacity-70 mb-2 inline-flex items-center gap-2">
                      👤 {offererName} · 📅 {new Date(o.created_at).toLocaleString("ar-SA")}
                    </div>

                    {o.message && (
                      <div className="rounded-xl bg-black/[.03] dark:bg-white/[.05] px-3 py-2 text-sm mb-2">
                        <span className="opacity-60 text-[11px] font-bold">رسالة المشتري:</span>
                        <div className="mt-1">{o.message}</div>
                      </div>
                    )}
                    {o.counter_message && (
                      <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2 text-sm mb-2">
                        <span className="opacity-70 text-[11px] font-bold">رسالتك بالعرض المضاد:</span>
                        <div className="mt-1">{o.counter_message}</div>
                      </div>
                    )}

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
