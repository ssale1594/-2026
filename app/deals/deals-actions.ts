"use server";

import { requireUser as requireUser, requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function buyerInitiateDeal(
  listingId: string | null,
  sellerId: string,
  title: string,
  description: string,
  price: number | null,
  deadline: string | null,
  notes: string
) {
  const user = await requireUser();
  const supabase = await createClient();
  if (user.id === sellerId) return { error: "لا يمكنك بدء صفقة مع نفسك" };

  const payload: any = {
    buyer_id: user.id,
    seller_id: sellerId,
    title: (title || "").slice(0, 250),
    description: (description || "").slice(0, 2000),
    price_agreed_sar: price ?? null,
    deadline_date: deadline || null,
    delivery_notes: (notes || "").slice(0, 2000),
  };
  if (listingId) payload.listing_id = listingId;

  const insQ = await supabase.from("deals").insert(payload).select("id");
  if (insQ.error) return { error: insQ.error.message };

  revalidatePath("/my/deals");
  revalidatePath("/dashboard/deals");
  revalidatePath(`/seller`);
  return { ok: true, dealId: (insQ.data?.[0] as any)?.id ?? null };
}

export async function sellerRespondToDeal(
  dealId: number,
  response: "accepted" | "rejected",
  reason: string
) {
  const seller = await requireSeller();
  const supabase = await createClient();

  // تحقق من أن الصفقة تخص هذا البائع
  const exist = await supabase
    .from("deals")
    .select("id, status, seller_id")
    .eq("id", dealId)
    .single();
  if (exist.error) return { error: exist.error.message };
  if ((exist.data as any).seller_id !== seller.id) return { error: "ليست صفقتك" };
  if ((exist.data as any).status !== "pending") return { error: "هذه الصفقة ليست في حالة انتظار" };

  const patch: any = { status: response };
  if (response === "rejected" && reason) patch.rejected_reason = reason.slice(0, 1000);
  const updQ = await supabase.from("deals").update(patch).eq("id", dealId);
  if (updQ.error) return { error: updQ.error.message };
  revalidatePath("/my/deals");
  revalidatePath("/dashboard/deals");
  revalidatePath(`/seller`);
  return { ok: true };
}

export async function buyerConfirmOrDispute(
  dealId: number,
  action: "confirm" | "dispute" | "cancel",
  reason: string
) {
  const user = await requireUser();
  const supabase = await createClient();
  const exist = await supabase
    .from("deals")
    .select("id, status, buyer_id, accepted_at")
    .eq("id", dealId)
    .single();
  if (exist.error) return { error: exist.error.message };
  if ((exist.data as any).buyer_id !== user.id) return { error: "ليست صفقتك كعميل" };

  const st = (exist.data as any).status;
  const patch: any = {};
  if (action === "confirm") {
    if (st !== "accepted") return { error: "لا يمكن تأكيدها في هذه الحالة" };
    patch.status = "buyer_confirmed";
  } else if (action === "dispute") {
    if (!["accepted", "buyer_confirmed"].includes(st))
      return { error: "لا يمكن رفع خصومة الآن" };
    patch.status = "disputed";
    if (reason) patch.dispute_reason = reason.slice(0, 2000);
  } else if (action === "cancel") {
    if (!["pending", "accepted"].includes(st))
      return { error: "لا يمكن الإلغاء الآن" };
    patch.status = "cancelled";
    patch.cancelled_by = user.id;
    if (reason) patch.cancelled_reason = reason.slice(0, 1000);
  }
  const updQ = await supabase.from("deals").update(patch).eq("id", dealId);
  if (updQ.error) return { error: updQ.error.message };
  revalidatePath("/my/deals");
  revalidatePath("/dashboard/deals");
  revalidatePath(`/seller`);
  return { ok: true };
}

export async function sellerMarkComplete(dealId: number, finalNote: string) {
  const seller = await requireSeller();
  const supabase = await createClient();
  const exist = await supabase
    .from("deals")
    .select("id, status, seller_id")
    .eq("id", dealId)
    .single();
  if (exist.error) return { error: exist.error.message };
  if ((exist.data as any).seller_id !== seller.id) return { error: "ليست صفقتك" };
  if (!["accepted", "buyer_confirmed"].includes((exist.data as any).status))
    return { error: "لا يمكن إنهاءها الآن" };
  const patch: any = { status: "completed" };
  if (finalNote) patch.delivery_notes = finalNote.slice(0, 2000);
  const updQ = await supabase.from("deals").update(patch).eq("id", dealId);
  if (updQ.error) return { error: updQ.error.message };
  revalidatePath("/my/deals");
  revalidatePath("/dashboard/deals");
  revalidatePath(`/seller`);
  return { ok: true };
}
