"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { reviewInputSchema } from "@/lib/validation/review";

export type ClaimState = { error?: string; success?: boolean };
export type ReviewFormState = { error?: string; success?: boolean };

// Called from a listing page: "I dealt with this seller". Creates a pending
// claim the seller must confirm before any review is possible.
export async function claimTransaction(
  listingId: string,
  sellerId: string
): Promise<ClaimState> {
  const user = await requireUser();

  if (user.id === sellerId) {
    return { error: "ما تقدر تقيّم نفسك." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert({
    listing_id: listingId,
    seller_id: sellerId,
    buyer_id: user.id,
    status: "claimed",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "سبق وسجلت تعاملك مع هذا الإعلان." };
    }
    return { error: "ما قدرنا نسجّل التعامل — جرّب مرة ثانية." };
  }

  revalidatePath("/my/transactions");
  return { success: true };
}

export async function submitReview(
  transactionId: number,
  sellerId: string,
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const user = await requireUser();

  const parsed = reviewInputSchema.safeParse({
    rating: formData.get("rating"),
    comment: formData.get("comment") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // The RLS policy is the real gate (it re-verifies the transaction is
  // confirmed and belongs to this buyer); this insert just carries the data.
  const { error } = await supabase.from("reviews").insert({
    transaction_id: transactionId,
    seller_id: sellerId,
    buyer_id: user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "سبق وقيّمت هذا التعامل." };
    }
    return { error: "ما قدرنا نحفظ التقييم — تأكد إن البائع أكّد التعامل أولًا." };
  }

  revalidatePath("/my/transactions");
  return { success: true };
}
