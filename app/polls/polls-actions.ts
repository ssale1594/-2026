"use server";

import { requireUser } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function castPollVote(pollId: number, optionId: number) {
  const user = await requireUser();
  const supabase = await createClient();

  // التحقق من حالة الاستفتاء active
  const pollQ = await supabase.from("polls").select("status").eq("id", pollId).single();
  const poll = pollQ.data as any;
  if (!poll) return { error: "الاستفتاء غير موجود" };
  if (poll.status !== "active") return { error: "هذا الاستفتاء مغلق للتصويت" };

  // التحقق من أن الخيارة تنتمي للاستفتاء
  const optQ = await supabase
    .from("poll_options")
    .select("id, poll_id")
    .eq("id", optionId)
    .eq("poll_id", pollId)
    .maybeSingle();
  if (!optQ.data) return { error: "الخيار غير صالح لهذا الاستفتاء" };

  // التحقق من عدم وجود صوت سابق عبر المحدد unique (poll_id, voter_id)
  const prevQ = await supabase
    .from("poll_votes")
    .select("id")
    .eq("poll_id", pollId)
    .eq("voter_id", user.id)
    .maybeSingle();
  if (prevQ.data) return { error: "لقد صوّرت بالفعل على هذا الاستفتاء، شكراً لمشاركتك!" };

  const insertQ = await supabase.from("poll_votes").insert({
    poll_id: pollId,
    option_id: optionId,
    voter_id: user.id,
  });
  if (insertQ.error) return { error: insertQ.error.message };

  revalidatePath("/polls");
  revalidatePath(`/seller`);
  return { ok: true };
}

export async function adminCreatePoll(
  title: string,
  description: string,
  optionSellerIds: string[],
  weekStart: string,
  weekEnd: string
) {
  await requireAdmin();
  const supabase = await createClient();

  const rpcQ = await (supabase.rpc as any)("admin_create_weekly_poll", {
    p_title: title,
    p_description: description,
  });
  const pollId = typeof rpcQ.data === "number" ? rpcQ.data : null;
  if (!pollId) return { error: "تعذر إنشاء الاستفتاء" };

  // تعديل التواريخ لو المستخدم عطانا تواريخ مخصصة
  if (weekStart || weekEnd) {
    const patch: any = {};
    if (weekStart) patch.week_start_date = weekStart;
    if (weekEnd) patch.week_end_date = weekEnd;
    await supabase.from("polls").update(patch).eq("id", pollId);
  }

  // إضافة الخيارات
  const opts = optionSellerIds.map((sid, i) => ({
    poll_id: pollId,
    seller_id: sid,
    sort_order: i,
  }));
  if (opts.length > 0) {
    await supabase.from("poll_options").insert(opts);
  }

  revalidatePath("/polls");
  revalidatePath("/admin/polls");
  return { pollId };
}

export async function adminSetPollStatus(pollId: number, status: "draft" | "active" | "closed") {
  await requireAdmin();
  const supabase = await createClient();

  if (status === "closed") {
    // استدعاء الدالة اللي تحسب الفائز وتعطي بادج
    const rpcQ = await (supabase.rpc as any)("close_poll_and_set_winner", { p_poll_id: pollId });
    if (rpcQ.error) return { error: rpcQ.error.message };
  } else {
    const updQ = await supabase
      .from("polls")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", pollId);
    if (updQ.error) return { error: updQ.error.message };
  }

  revalidatePath("/polls");
  revalidatePath("/admin/polls");
  return { ok: true };
}

export async function adminAddOption(pollId: number, sellerId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const existing = await supabase
    .from("poll_options")
    .select("sort_order")
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing.data?.[0]?.sort_order ?? -1) + 1;
  const insQ = await supabase.from("poll_options").insert({
    poll_id: pollId,
    seller_id: sellerId,
    sort_order: nextOrder,
  });
  if (insQ.error) return { error: insQ.error.message };
  revalidatePath("/polls");
  revalidatePath("/admin/polls");
  return { ok: true };
}

export async function adminRemoveOption(optionId: number) {
  await requireAdmin();
  const supabase = await createClient();
  const delQ = await supabase.from("poll_options").delete().eq("id", optionId);
  if (delQ.error) return { error: delQ.error.message };
  revalidatePath("/polls");
  revalidatePath("/admin/polls");
  return { ok: true };
}
