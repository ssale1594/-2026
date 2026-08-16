"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { needResponseSchema } from "@/lib/validation/need-request";

export type NeedResponseFormState = { error?: string; success?: boolean };

export async function respondToNeed(
  requestId: number,
  _prevState: NeedResponseFormState,
  formData: FormData
): Promise<NeedResponseFormState> {
  const seller = await requireSeller();

  if (seller.verification_status !== "approved") {
    return { error: "حسابك لسا تحت المراجعة — ما تقدر ترد على الطلبات بعد." };
  }

  const parsed = needResponseSchema.safeParse({
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("need_responses").insert({
    request_id: requestId,
    seller_id: seller.id,
    message: parsed.data.message,
  });

  if (error) {
    // unique (request_id, seller_id) — one response per seller per request.
    if (error.code === "23505") {
      return { error: "سبق ورديت على هذا الطلب." };
    }
    return { error: "ما قدرنا نحفظ ردك — جرّب مرة ثانية." };
  }

  revalidatePath("/dashboard/needs");
  return { success: true };
}
