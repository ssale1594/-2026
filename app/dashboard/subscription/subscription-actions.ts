"use server";

import { requireSeller, requireUser as requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Tier = "free" | "silver" | "gold" | "diamond";

export async function setSubscriptionAutoRenew(enable: boolean, reason?: string) {
  const seller = await requireSeller();
  const supabase = await createClient();
  const patch: any = { auto_renew: !!enable };
  if (!enable && reason) patch.cancellation_reason = reason.slice(0, 500);
  const q = await supabase
    .from("seller_subscriptions")
    .upsert(
      { seller_id: seller.id, tier: "free", active_listing_limit: 10, ...patch },
      { onConflict: "seller_id" }
    );
  if (q.error) return { error: q.error.message };
  revalidatePath("/dashboard/subscription");
  return { ok: true };
}

export async function simulateUpgradeTier(newTier: Tier, months: number = 1) {
  // للبيئة الديمو فقط — في الانتاج يجب ربطه بمزود الدفع (Tap Payments).
  // نضيف سمة DEMO_ONLY لمعرفة أن هذه الترقية لم تُدفع فعلياً.
  const seller = await requireSeller();
  const supabase = await createClient();
  const tierPrices: Record<Tier, number> = {
    free: 0,
    silver: 149,
    gold: 349,
    diamond: 799,
  };
  const tierLimits: Record<Tier, { limit: number; feat: boolean; quota: number; lvl: number }> = {
    free:    { limit: 10,  feat: false, quota: 0,  lvl: 0 },
    silver:  { limit: 30,  feat: false, quota: 1,  lvl: 1 },
    gold:    { limit: 100, feat: true,  quota: 3,  lvl: 2 },
    diamond: { limit: 9999,feat: true,  quota: 10, lvl: 3 },
  };
  const payload: any = {
    seller_id: seller.id,
    tier: newTier,
    active_listing_limit: tierLimits[newTier].limit,
    can_featured_ad: tierLimits[newTier].feat,
    featured_quota_monthly: tierLimits[newTier].quota,
    premium_badge_level: tierLimits[newTier].lvl,
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toISOString(),
    status: "active",
    auto_renew: false,
    payment_provider: "DEMO_ONLY",
    payment_reference: `DEMO_${newTier}_${Date.now()}`,
    amount_paid_sar: tierPrices[newTier] * months,
  };
  const q = await supabase
    .from("seller_subscriptions")
    .upsert(payload, { onConflict: "seller_id" });
  if (q.error) return { error: q.error.message };
  revalidatePath("/dashboard/subscription");
  revalidatePath(`/seller/${seller.slug}`);
  revalidatePath("/");
  return { ok: true, amount: payload.amount_paid_sar };
}

export async function requestFeaturedListing(listingId: string, days = 7) {
  const seller = await requireSeller();
  const supabase = await createClient();
  // تحقق الحدود + صلاحية الإعلان
  const subQ = await (supabase.rpc as any)("get_seller_subscription", {
    p_seller_id: seller.id,
  });
  const sub = (subQ.data as any[])?.[0];
  if (!sub?.can_featured_ad) return { error: "عضويتك لا تسمح بتعزيز الإعلانات. قم بترقية العضوية." };
  const used = sub.features_used_featured ?? 0;
  const quota = sub.featured_quota_monthly ?? 0;
  if (used >= quota) return { error: "استنفدت حصتك الشهرية من التعزيزات. رجاءً ترقِ عضوياً أو انتظر الشهر القادم." };

  // تحقق أن الإعلان للبائع ومكتوب
  const lQ = await supabase
    .from("listings")
    .select("id, seller_id, status")
    .eq("id", listingId)
    .single();
  if (lQ.error) return { error: "الإعلان غير موجود" };
  if ((lQ.data as any).seller_id !== seller.id) return { error: "ليس إعلانك" };
  if ((lQ.data as any).status !== "published") return { error: "الإعلان غير منشور" };

  // زيادة العداد
  await supabase
    .from("seller_subscriptions")
    .update({ features_used_featured: used + 1 })
    .eq("seller_id", seller.id);

  // إدراج التعزيز (7 أيام افتراضياً)
  const d = days;
  const insQ = await supabase.from("featured_listings").insert({
    listing_id: listingId,
    seller_id: seller.id,
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + d * 24 * 3600 * 1000).toISOString(),
    note: "طلب عبر لوحة التحكم",
  });
  if (insQ.error) return { error: insQ.error.message };
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/dashboard/subscription");
  return { ok: true };
}

// ضمان وجود سجل subscription للبائع الجديد (يُستدعى من واجهة الإعداد إذا لم يكن موجوداً)
export async function ensureFreeSubscriptionRow() {
  const seller = await requireSeller();
  const supabase = await createClient();
  const q = await supabase
    .from("seller_subscriptions")
    .upsert(
      { seller_id: seller.id, tier: "free", active_listing_limit: 10, status: "active" },
      { onConflict: "seller_id" }
    );
  if (q.error) return { error: q.error.message };
  return { ok: true };
}

const _ = requireUser; // silence unused
