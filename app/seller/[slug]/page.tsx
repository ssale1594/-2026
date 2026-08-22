import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { getSellerBySlug } from "@/lib/data/sellers";
import { relativeTimeAr } from "@/lib/relative-time";
import { getSellerTrust } from "@/lib/data/trust";
import { getSellerActivity } from "@/lib/data/activity";
import TrustBadge from "@/components/trust-badge";
import ActivityIndicator from "@/components/activity-indicator";
import VouchButton from "./vouch-button";
import StartDealDialog from "@/components/start-deal-dialog";
import PremiumBadge from "@/components/premium-badge";
import StartChatButton from "@/app/my/inbox/start-chat-button";
import {
  computeMilestones,
  MilestoneBadgeCard,
  type MilestoneBadge,
} from "@/components/milestone-badges";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getSellerBySlug(slug);

  if (!seller) {
    return { title: pageTitle("بائع غير موجود") };
  }

  return {
    title: pageTitle(`${seller.business_name} بالزلفي`),
    description:
      seller.description?.slice(0, 160) ??
      `${seller.business_name} بالزلفي — تصفح إعلاناته وتواصل مباشرة عبر واتساب.`,
  };
}

export default async function SellerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seller = await getSellerBySlug(slug);

  if (!seller) {
    notFound();
  }

  const supabase = await createClient();
  const [
    { data: listings },
    { data: ratingRows },
    { data: reviews },
    { data: pollWins },
    dealsQ,
    subQ,
    endorsementsQ,
    metricsQ,
    recommendQ,
    feedbackQ,
    availabilityQ,
  ] = await Promise.all([
      supabase
        .from("listings")
        .select("id, title, slug, price, price_negotiable")
        .eq("seller_id", seller.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase.rpc("seller_rating", { p_seller_id: seller.id }),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<
          { id: number; rating: number; comment: string | null; created_at: string }[]
        >(),
      supabase
        .from("polls")
        .select("id, title, week_start_date, week_end_date, status")
        .eq("winner_seller_id", seller.id)
        .eq("status", "closed")
        .order("week_end_date", { ascending: false })
        .limit(5),
      (supabase.rpc as any)("seller_public_deal_stats", { p_seller_id: seller.id }),
      (supabase.rpc as any)("seller_public_tier", { p_seller_id: seller.id }),
      (supabase.rpc as any)("seller_endorsement_summary", { p_seller_id: seller.id }),
      (supabase.rpc as any)("seller_milestone_metrics", { p_seller_id: seller.id }),
      (supabase.rpc as any)("seller_recommend_rate", { p_seller_id: seller.id }),
      (supabase.rpc as any)("seller_recent_feedback", {
        p_seller_id: seller.id,
        p_limit: 20,
      }),
      supabase
        .from("seller_availability")
        .select("id")
        .eq("seller_id", seller.id)
        .eq("is_closed", false)
        .limit(1),
    ]);

  const recommend = (recommendQ?.data as any[])?.[0] ?? null;
  const dealFeedback = (feedbackQ?.data as any[]) ?? [];
  // The booking link only appears when the seller actually has open hours —
  // otherwise it leads to an empty calendar.
  const acceptsBookings = ((availabilityQ?.data as any[]) ?? []).length > 0;

  const rating = (ratingRows as { average: number | null; total: number }[] | null)?.[0];
  // النسخة العامة ترجّع إشارات الثقة فقط. الإيراد وعدد الخصومات
  // والصفقات قيد التنفيذ بيان تجاري خاص — لا يُعرض للزوار.
  const dealStats = (dealsQ?.data as any[])?.[0] ?? {
    completed_count: 0,
    last30d_completed: 0,
  };
  const subStats = { tier: (subQ?.data as string | null) ?? null };
  const endorsements = (endorsementsQ?.data as any[])?.[0] ?? {
    vouch_count: 0,
    with_comment_count: 0,
    latest_vouch_at: null,
    top_relation: null,
    last_comment: null,
  };
  const rawMetrics = (metricsQ?.data as any[])?.[0] ?? {
    total_listings_published: 0,
    avg_images_per_listing: 0,
    avg_first_reply_minutes_last10: 0,
    read_rate_last10: 0,
    vouch_count: 0,
    completed_deals: 0,
    completed_last30d: 0,
  };

  const milestones: MilestoneBadge[] = computeMilestones({
    seller_id: seller.id,
    created_at: String((seller as any).created_at ?? new Date().toISOString()),
    total_listings_published: Number(rawMetrics.total_listings_published || 0),
    avg_images_per_listing: Number(rawMetrics.avg_images_per_listing || 0),
    avg_first_reply_minutes_last10: Number(rawMetrics.avg_first_reply_minutes_last10 || 0),
    read_rate_last10: Number(rawMetrics.read_rate_last10 || 0),
    vouch_count: Number((rawMetrics as any).vouch_count ?? endorsements.vouch_count ?? 0),
    completed_deals: Number((rawMetrics as any).completed_deals ?? dealStats.completed_count ?? 0),
    completed_last30d: Number((rawMetrics as any).completed_last30d ?? dealStats.last30d_completed ?? 0),
    tier: subStats?.tier ?? null,
  });
  const unlockedCount = milestones.filter((m) => m.unlocked).length;

  // Fetch last 20 vouches (endorsement feed)
  let vouchFeed: any[] = [];
  if (Number(endorsements.vouch_count || 0) > 0) {
    const feedQ = await (supabase.rpc as any)("seller_vouch_feed", {
      p_seller_id: seller.id,
      p_limit: 20,
    });
    vouchFeed = (feedQ?.data as any[]) ?? [];
  }

  const [
    {
      data: { user },
    },
    trust,
    activity,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getSellerTrust(seller.id),
    getSellerActivity(seller.id),
  ]);

  // Only asked once we know there's a signed-in visitor who isn't the seller.
  const { data: existingVouch } =
    user && user.id !== seller.id
      ? await supabase
          .from("vouches")
          .select("id")
          .eq("seller_id", seller.id)
          .eq("voucher_id", user.id)
          .maybeSingle()
      : { data: null };

  // wa.me requires digits only (country code, no leading +/00/spaces).
  const whatsappHref = `https://wa.me/${seller.whatsapp_number.replace(/\D/g, "")}`;

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold inline-flex items-center gap-2 flex-wrap">
              {seller.business_name}
              <PremiumBadge tier={subStats?.tier as any} />
            </h1>
            {(pollWins && pollWins.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 px-2.5 py-1 text-xs font-bold shadow-sm"
                  title="فاز بأفضل بائع الأسبوع"
                >
                  👑 فوز بأفضل بائع الأسبوع × {pollWins.length}
                </span>
                {pollWins.slice(0, 3).map((pw: any) => (
                  <Link
                    key={pw.id}
                    href="/polls"
                    className="text-[10px] opacity-80 hover:underline"
                    title={new Date(pw.week_end_date).toLocaleDateString("ar-SA", {
                      month: "short",
                      day: "numeric",
                    })}
                  >
                    · {new Date(pw.week_end_date).toLocaleDateString("ar-SA", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Link>
                ))}
              </div>
            )}

            {Number(dealStats.completed_count || 0) > 0 && (
              <div
                className="mt-2 inline-flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-emerald-950/40 dark:via-neutral-900 dark:to-emerald-950/40 px-3.5 py-2 shadow-sm"
                title="إجمالي الصفقات المغلقة بنجاح عبر المنصة"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
                  🏆 المعاملات الناجحة: {Number(dealStats.completed_count).toLocaleString("ar-SA")} صفقة
                </span>
                {Number(dealStats.last30d_completed || 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                    · منها {Number(dealStats.last30d_completed).toLocaleString("ar-SA")} خلال 30 يومًا
                  </span>
                )}
              </div>
            )}

            <div className="mt-2">
              <TrustBadge trust={trust} showDetail />
            </div>
            <div className="mt-1">
              <ActivityIndicator activity={activity} />
            </div>
            {rating && rating.total > 0 && (
              <div className="text-sm text-black/60 dark:text-white/60 mt-1">
                ★ {rating.average} · {rating.total} تقييم موثّق
                {recommend?.recommend_pct != null && (
                  <> · {recommend.recommend_pct}٪ يوصون فيه</>
                )}
              </div>
            )}

            {acceptsBookings && (
              <div className="mt-3">
                <Link
                  href={`/booking/${slug}`}
                  className="inline-block rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2"
                >
                  📅 احجز موعد
                </Link>
              </div>
            )}

            {Number(endorsements.vouch_count || 0) > 0 && (
              <div className="mt-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 shadow-sm">
                  <span className="text-emerald-700 dark:text-emerald-200 font-extrabold inline-flex items-center gap-1.5">
                    🫂 {Number(endorsements.vouch_count).toLocaleString("ar-SA")} توصية من جيران الزلفي
                  </span>
                  {endorsements.top_relation && (
                    <span className="text-[11px] opacity-70 border-l border-emerald-500/30 pl-2 mr-1">
                      {(() => {
                        const m: Record<string, string> = {
                          customer: "زبائن",
                          repeated_customer: "زبائن دائمين",
                          neighbour: "جيران",
                          family: "أقارب",
                          friend: "أصدقاء",
                          service_provider: "مقدمي خدمات",
                          other: "مستخدمين",
                        };
                        return "أكثرها: " + (m[endorsements.top_relation] ?? endorsements.top_relation);
                      })()}
                    </span>
                  )}
                  {endorsements.latest_vouch_at && (
                    <span className="text-[10px] opacity-50 mr-2">
                      · آخرها {relativeTimeAr(endorsements.latest_vouch_at)}
                    </span>
                  )}
                </div>
                {endorsements.last_comment && (
                  <div className="text-xs opacity-70 mt-1.5 max-w-lg line-clamp-2">
                    <q>
                      {endorsements.last_comment}
                    </q>
                  </div>
                )}
              </div>
            )}
            {seller.description && (
              <p className="text-black/60 dark:text-white/60 mt-1">
                {seller.description}
              </p>
            )}
            <div className="mt-3">
              <VouchButton
                sellerId={seller.id}
                isSignedIn={Boolean(user)}
                alreadyVouched={Boolean(existingVouch)}
                isSelf={user?.id === seller.id}
              />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-green-600 text-white text-sm font-medium px-4 py-2 hover:bg-green-700 transition-colors"
            >
              تواصل واتساب
            </a>
            {user && user.id !== seller.id && (
              <>
                <StartChatButton
                  sellerId={seller.id}
                  sellerName={seller.business_name}
                  subject={`استفسار عام من صفحة البائع`}
                  label="💬 تواصل داخل المنصة"
                  variant="subtle"
                  className="!rounded-full !py-1.5 !text-xs !w-full justify-center"
                />
                <StartDealDialog
                  sellerId={seller.id}
                  sellerName={seller.business_name}
                  className="!rounded-full !py-1.5 !text-xs !bg-neutral-900 hover:!bg-black dark:!bg-white dark:!text-black dark:hover:!bg-neutral-100"
                />
              </>
            )}
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">إعلانات البائع</h2>

        {!listings || listings.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه إعلانات منشورة لهذا البائع حاليًا.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link
                  href={`/listing/${listing.slug}`}
                  className="block rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                >
                  <div className="font-medium mb-1">{listing.title}</div>
                  {listing.price != null && (
                    <div className="text-sm text-black/60 dark:text-white/60">
                      {listing.price} ر.س
                      {listing.price_negotiable ? " (قابل للتفاوض)" : ""}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {dealFeedback.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-1">
              تقييمات العملاء بعد الصفقات
            </h2>
            <p className="text-xs text-black/50 dark:text-white/50 mb-4">
              كل تقييم هنا من مشترٍ أتمّ صفقة فعلية مع البائع على المنصة — مرة
              واحدة لكل صفقة، ولا يمكن تعديله بعد إرساله.
            </p>
            <ul className="flex flex-col gap-3">
              {dealFeedback.map((f: any) => (
                <li
                  key={f.id}
                  className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{"★".repeat(f.rating_stars)}</span>
                    <span
                      className={
                        f.would_recommend
                          ? "text-xs text-emerald-700 dark:text-emerald-300"
                          : "text-xs text-black/50 dark:text-white/50"
                      }
                    >
                      {f.would_recommend ? "👍 يوصي فيه" : "👎 ما يوصي"}
                    </span>
                  </div>
                  {f.comment && (
                    <p className="text-sm text-black/70 dark:text-white/70 mt-1">
                      {f.comment}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                    {f.reviewer_name} · {relativeTimeAr(f.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reviews && reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-1">تقييمات موثّقة</h2>
            <p className="text-xs text-black/50 dark:text-white/50 mb-4">
              كل تقييم هنا من عميل أكّد البائع نفسه إنه تعامل معه.
            </p>
            <ul className="flex flex-col gap-3">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
                >
                  <div className="text-sm">{"★".repeat(review.rating)}</div>
                  {review.comment && (
                    <p className="text-sm text-black/70 dark:text-white/70 mt-1">
                      {review.comment}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                    {relativeTimeAr(review.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold inline-flex items-center gap-2">
                🏅 شارات الإنجاز
                <span className="text-xs opacity-60">
                  · {unlockedCount} / {milestones.length} مكتملة
                </span>
              </h2>
              <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                كل ما تحقّقه من علامات رفعت شارة جديدة تحت اسمك.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {milestones.map((m) => (
              <MilestoneBadgeCard key={m.slug} badge={m} />
            ))}
          </div>
        </section>

        {vouchFeed.length > 0 && (
          <section className="mt-12">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold inline-flex items-center gap-2">
                  🫂 شهادات وتوصيات الجيران
                  <span className="text-xs opacity-60">· {vouchFeed.length} توصية حديثة</span>
                </h2>
                <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                  توصيات من أهل الحي وزبائن البائع — بدون تدخل إدارة!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vouchFeed.map((v) => {
                const relLabel: Record<string, string> = {
                  customer: "زبون",
                  repeated_customer: "زبون دائم",
                  neighbour: "جارٍ في الحي",
                  family: "قريب / عائلة",
                  friend: "صديق",
                  service_provider: "تعامل معه كمقدم خدمات",
                  other: "عضو المجتمع",
                };
                return (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-emerald-950/30 dark:via-neutral-900 dark:to-emerald-950/30 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-black/5 dark:border-white/10 shrink-0 bg-white dark:bg-neutral-800 grid place-items-center">
                        {v.voucher_avatar ? (
                          <img src={v.voucher_avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-lg opacity-60">👤</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <b className="text-sm">{v.voucher_full_name}</b>
                          {v.trust_label && (
                            <span className="text-[10px] rounded-full bg-neutral-900 dark:bg-white text-white dark:text-black px-2 py-0.5">
                              {v.trust_label}
                            </span>
                          )}
                          {v.relation && (
                            <span className="text-[10px] rounded-full border border-emerald-500/40 text-emerald-700 dark:text-emerald-200 px-2 py-0.5">
                              {relLabel[v.relation] ?? v.relation}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] opacity-55 mt-0.5 mb-1.5">
                          {relativeTimeAr(v.created_at)}
                        </div>
                        {v.comment ? (
                          <p className="text-sm leading-relaxed">{v.comment}</p>
                        ) : (
                          <p className="text-sm opacity-60 italic">
                            — توصية بدون تعليق.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
