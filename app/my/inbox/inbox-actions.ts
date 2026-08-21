"use server";

import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getOrCreateThread(input: {
  listingId?: string | null;
  dealId?: number | null;
  buyerId?: string | null;
  sellerId?: string | null;
  subject?: string | null;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  let buyerId = input.buyerId;
  let sellerId = input.sellerId;

  // إذا لم يُحدد من هو البائع والعميل، نستدل:
  if (input.listingId && (!buyerId || !sellerId)) {
    const lq = await supabase
      .from("listings")
      .select("seller_id")
      .eq("id", input.listingId)
      .single();
    if (lq.error) return { error: "الإعلان غير موجود" };
    sellerId = (lq.data as any).seller_id;
    buyerId = user.id;
  }
  if (input.dealId && (!buyerId || !sellerId)) {
    const dq = await supabase
      .from("deals")
      .select("buyer_id, seller_id")
      .eq("id", input.dealId)
      .single();
    if (dq.error) return { error: "الصفقة غير موجودة" };
    buyerId = (dq.data as any).buyer_id;
    sellerId = (dq.data as any).seller_id;
  }

  if (!buyerId || !sellerId) return { error: "تعذر تحديد طرفي المحادثة" };

  const q = await (supabase.rpc as any)("chat_upsert_thread", {
    p_listing_id: input.listingId ?? null,
    p_deal_id: input.dealId ?? null,
    p_buyer_id: buyerId,
    p_seller_id: sellerId,
    p_subject: input.subject ?? null,
  });
  if (q.error) return { error: q.error.message };
  revalidatePath("/my/inbox");
  revalidatePath("/dashboard/inbox");
  return { threadId: (q.data as any)?.[0] ?? q.data ?? null };
}

const SendMsgSchema = z.object({
  threadId: z.number().int().positive(),
  body: z.string().trim().min(1, "الرسالة فارغة").max(5000, "الرسالة أطول من 5000 حرف"),
});

export async function sendChatMessage(raw: unknown) {
  const user = await requireUser();
  const parsed = SendMsgSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "رسالة غير صالحة" };
  const supabase = await createClient();

  // تحقق من أن المستخدم عضو في thread
  const tq = await supabase
    .from("chat_threads")
    .select("id, buyer_id, seller_id")
    .eq("id", parsed.data.threadId)
    .single();
  if (tq.error) return { error: tq.error.message };
  const t = tq.data as any;
  if (t.buyer_id !== user.id && t.seller_id !== user.id)
    return { error: "ليست محادثتك" };

  const ins = await supabase.from("chat_messages").insert({
    thread_id: parsed.data.threadId,
    sender_id: user.id,
    body: parsed.data.body,
  });
  if (ins.error) return { error: ins.error.message };
  revalidatePath("/my/inbox");
  revalidatePath("/my/chat");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/chat");
  return { ok: true };
}

export async function markThreadRead(threadId: number) {
  await requireUser();
  const supabase = await createClient();
  const q = await (supabase.rpc as any)("chat_mark_thread_read", {
    p_thread_id: threadId,
  });
  if (q.error) return { error: q.error.message };
  revalidatePath("/my/inbox");
  revalidatePath("/my/chat");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/chat");
  return { ok: true };
}

export async function archiveThread(threadId: number, side: "buyer" | "seller") {
  const user = await requireUser();
  const supabase = await createClient();
  const tq = await supabase
    .from("chat_threads")
    .select("id, buyer_id, seller_id, archived_by_buyer, archived_by_seller")
    .eq("id", threadId)
    .single();
  if (tq.error) return { error: tq.error.message };
  const t = tq.data as any;
  const column = side === "buyer" ? "archived_by_buyer" : "archived_by_seller";
  if ((side === "buyer" ? t.buyer_id : t.seller_id) !== user.id)
    return { error: "ليست محادثتك" };
  const patch: any = {};
  patch[column] = !(t as any)[column];
  await supabase.from("chat_threads").update(patch).eq("id", threadId);
  revalidatePath("/my/inbox");
  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

const _u = requireUser;
