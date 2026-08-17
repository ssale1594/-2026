"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

// Not exported: a "use server" file may only export async functions.
const FeedbackSchema = z.object({
  dealId: z.number().int().positive(),
  ratingStars: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean(),
  comment: z.string().trim().max(600).optional().or(z.literal("")),
});

export async function submitDealFeedback(raw: unknown) {
  const user = await requireUser();
  const parsed = FeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات تقييم غير صالحة." };
  }
  const v = parsed.data;
  const supabase = await createClient();

  // The seller is read from the deal rather than taken from the client, and the
  // eligibility rules (buyer of this deal, deal completed, not already rated)
  // are re-enforced by the RLS insert policy and the unique(deal_id) constraint
  // — this lookup only produces a readable error instead of a raw 42501.
  const { data: deal } = await supabase
    .from("deals")
    .select("id, buyer_id, seller_id, status")
    .eq("id", v.dealId)
    .maybeSingle();

  if (!deal) return { error: "الصفقة غير موجودة." };
  const d = deal as any;
  if (d.buyer_id !== user.id) return { error: "التقييم للمشتري في الصفقة فقط." };
  if (!["buyer_confirmed", "completed"].includes(d.status)) {
    return { error: "قيّم بعد اكتمال الصفقة." };
  }

  const { error } = await supabase.from("deal_feedback").insert({
    deal_id: v.dealId,
    reviewer_id: user.id,
    reviewee_id: d.seller_id,
    rating_stars: v.ratingStars,
    would_recommend: v.wouldRecommend,
    comment: v.comment || null,
  });

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return { error: "قيّمت هذه الصفقة من قبل — التقييم يُرسل مرة واحدة." };
    }
    return { error: error.message };
  }

  revalidatePath("/my/deals");
  revalidatePath("/dashboard/deals");
  return { ok: true };
}
