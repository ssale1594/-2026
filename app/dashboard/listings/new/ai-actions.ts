"use server";

import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { draftListing, type ListingDraft } from "@/lib/ai/listing-writer";
import { isListingWriterEnabled } from "@/lib/ai/config";

const DAILY_LIMIT = 10;

export type DraftResult =
  | { ok: true; draft: ListingDraft; usedToday: number; dailyLimit: number }
  | { ok: false; error: string };

export async function generateListingDraft(
  rawDescription: string
): Promise<DraftResult> {
  // البائع يُحلّ من الجلسة لا من الواجهة (TECH.md §12.5).
  const seller = await requireSeller();

  if (!isListingWriterEnabled()) {
    return { ok: false, error: "المساعد غير مفعّل على هذا الموقع." };
  }

  const supabase = await createClient();

  // الحصة تُطالَب قبل الاستدعاء لا بعده: استدعاء يفشل بعد خصم الحصة
  // أهون من استدعاء يُحاسَب عليه بلا حد.
  const { data: quotaRows, error: quotaError } = await (supabase.rpc as any)(
    "claim_ai_quota",
    { p_feature: "listing_writer", p_daily_limit: DAILY_LIMIT }
  );
  if (quotaError) {
    return { ok: false, error: "تعذّر التحقق من حصتك اليومية." };
  }
  const quota = (quotaRows as any[])?.[0];
  if (!quota?.allowed) {
    return {
      ok: false,
      error: `وصلت حدّك اليومي (${DAILY_LIMIT} مسودات). جرّب بكرة.`,
    };
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_ar")
    .eq("is_active", true)
    .order("sort_order");

  const result = await draftListing({
    rawDescription,
    categories: (categories as { id: number; name_ar: string }[]) ?? [],
  });

  if (!result.ok) return result;

  return {
    ok: true,
    draft: result.draft,
    usedToday: Number(quota.used_today) || 0,
    dailyLimit: DAILY_LIMIT,
  };
}
