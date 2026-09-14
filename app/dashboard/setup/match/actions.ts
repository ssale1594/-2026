"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type MatchClaimState = { error?: string; ok?: boolean };

// البائع يؤكد إن سجل بالدليل العام هو محله، فنرسل طلب تبنّي (Claim) نيابة
// عنه — يستخدم رقم واتساب حسابه المسجَّل أصلًا، فما نطلبه منه مرة ثانية.
// المصادقة النهائية تبقى بيد الإدارة (admin_decide_directory_claim).
export async function claimAsSeller(
  directoryEntryId: number
): Promise<MatchClaimState> {
  const seller = await requireSeller();
  const supabase = await createClient();

  // requireSeller() لا يرجّع whatsapp_number (يُستخدم بأماكن ثانية بدونه) —
  // نجيبه هنا مباشرة بدل تغيير دالة مشتركة.
  const { data: row } = await supabase
    .from("sellers")
    .select("whatsapp_number")
    .eq("id", seller.id)
    .single();

  const { error } = await supabase.rpc("submit_directory_claim", {
    p_directory_entry_id: directoryEntryId,
    p_whatsapp: row?.whatsapp_number ?? "",
    p_note: "تأكيد تلقائي أثناء التسجيل — تطابق اسم النشاط مع دليل خرائط قوقل.",
  });

  if (error) {
    return { error: "ما قدرنا نرسل الطلب — جرّب مرة ثانية." };
  }

  revalidatePath("/dashboard/setup/match");
  return { ok: true };
}
