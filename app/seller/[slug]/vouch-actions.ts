"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type VouchState = { error?: string; success?: boolean };

const Relation = z.enum(["customer", "neighbour", "family", "friend", "repeated_customer", "service_provider", "other"]);

const Schema = z.object({
  comment: z.string().trim().max(400, "التعليق طويل جداً").optional().or(z.literal("")),
  relation: Relation.optional(),
});

export async function vouchForSeller(
  sellerId: string,
  commentOrPayload?: string | { comment?: string; relation?: string }
): Promise<VouchState> {
  const user = await requireUser();

  if (user.id === sellerId) return { error: "ما تقدر توصّي بنفسك." };

  let comment: string | undefined;
  let relation: string | undefined;
  if (typeof commentOrPayload === "string") {
    comment = commentOrPayload || undefined;
  } else if (commentOrPayload) {
    const p = Schema.safeParse(commentOrPayload);
    if (!p.success) return { error: p.error.issues[0]?.message ?? "بيانات غير صالحة." };
    comment = p.data.comment || undefined;
    relation = p.data.relation;
  }

  const supabase = await createClient();
  const sellerQ = await supabase
    .from("sellers")
    .select("slug")
    .eq("id", sellerId)
    .maybeSingle();
  const seller = sellerQ.data as { slug?: string } | null;

  // تحديث توصية قديمة خلال 30 يوماً أو إنشاء جديدة
  const existingQ = await supabase
    .from("vouches")
    .select("id, created_at")
    .eq("seller_id", sellerId)
    .eq("voucher_id", user.id)
    .maybeSingle();
  const existing = existingQ.data as any;

  if (existing) {
    const created = new Date(existing.created_at).getTime();
    if (Date.now() - created > 30 * 24 * 3600 * 1000) {
      return { error: "لا يمكن تعديل التوصية بعد 30 يوماً." };
    }
    const upd = await supabase
      .from("vouches")
      .update({ comment: comment ?? null, relation: relation ?? null })
      .eq("id", existing.id);
    if (upd.error) return { error: upd.error.message };
  } else {
    const { error } = await supabase.from("vouches").insert({
      seller_id: sellerId,
      voucher_id: user.id,
      comment: comment ?? null,
      relation: relation ?? null,
    });
    if (error) {
      if (error.code === "23505") return { error: "سبق ووصّيت بهذا البائع." };
      return { error: "ما قدرنا نحفظ التوصية — جرّب مرة ثانية." };
    }
  }

  if (seller?.slug) revalidatePath(`/seller/${seller.slug}`);
  return { success: true };
}

export async function removeVouch(sellerId: string): Promise<VouchState> {
  const user = await requireUser();
  const supabase = await createClient();
  const sellerQ = await supabase.from("sellers").select("slug").eq("id", sellerId).maybeSingle();
  const seller = sellerQ.data as { slug?: string } | null;
  const { error } = await supabase
    .from("vouches")
    .delete()
    .eq("seller_id", sellerId)
    .eq("voucher_id", user.id);
  if (error) return { error: error.message };
  if (seller?.slug) revalidatePath(`/seller/${seller.slug}`);
  return { success: true };
}
