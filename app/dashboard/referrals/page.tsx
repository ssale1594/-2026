import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import DashboardHeader from "../dashboard-header";
import CopyLink from "./copy-link";

export default async function DashboardReferralsPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const [{ data: me }, { data: referrals }] = await Promise.all([
    supabase
      .from("sellers")
      .select("referral_code, referral_bonus_slots, free_listing_limit")
      .eq("id", seller.id)
      .single<{
        referral_code: string | null;
        referral_bonus_slots: number;
        free_listing_limit: number;
      }>(),
    supabase
      .from("seller_referrals")
      .select("id, status, created_at, qualified_at")
      .eq("referrer_seller_id", seller.id)
      .order("created_at", { ascending: false })
      .returns<
        {
          id: number;
          status: string;
          created_at: string;
          qualified_at: string | null;
        }[]
      >(),
  ]);

  const inviteLink = me?.referral_code
    ? `${siteUrl}/login?ref=${me.referral_code}`
    : null;

  const qualified = (referrals ?? []).filter((r) => r.status === "qualified").length;

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">ادعُ جارك</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          كل بائع تجيبه وينشر أول إعلان له، نضيف لك <strong>3 إعلانات
          مجانية</strong> إضافية.
        </p>

        {me?.referral_code && (
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 mb-8">
            <div className="text-sm text-black/60 dark:text-white/60 mb-1">
              كودك
            </div>
            <div className="text-2xl font-bold tracking-widest mb-3">
              {me.referral_code}
            </div>
            {inviteLink && <CopyLink link={inviteLink} />}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4">
            <div className="text-2xl font-semibold">{qualified}</div>
            <div className="text-xs text-black/50 dark:text-white/50">
              إحالة ناجحة
            </div>
          </div>
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4">
            <div className="text-2xl font-semibold">
              +{me?.referral_bonus_slots ?? 0}
            </div>
            <div className="text-xs text-black/50 dark:text-white/50">
              إعلان مجاني إضافي
            </div>
          </div>
        </div>

        <h2 className="font-semibold mb-3">إحالاتك</h2>
        {!referrals || referrals.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            ما فيه إحالات بعد — شارك كودك مع صاحب محل تعرفه.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {referrals.map((referral) => (
              <li
                key={referral.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-3 flex items-center justify-between text-sm"
              >
                <span>
                  {referral.status === "qualified"
                    ? "إحالة ناجحة"
                    : "بانتظار نشر أول إعلان"}
                </span>
                <span className="text-xs text-black/40 dark:text-white/40">
                  {relativeTimeAr(referral.qualified_at ?? referral.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
