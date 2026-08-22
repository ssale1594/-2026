"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type AmbassadorFormState = { error?: string; ok?: string };

export async function applyAsAmbassador(
  _prevState: AmbassadorFormState,
  formData: FormData
): Promise<AmbassadorFormState> {
  await requireUser();
  const supabase = await createClient();

  const neighborhoodId = Number(formData.get("neighborhoodId"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  if (!Number.isFinite(neighborhoodId) || neighborhoodId <= 0) {
    return { error: "اختر حيًا صالحًا." };
  }

  const { error } = await supabase.rpc("apply_neighborhood_ambassador", {
    p_neighborhood_id: neighborhoodId,
    p_note: note || null,
  });

  if (error) {
    return { error: "ما قدرنا نسجّل طلبك — جرّب مرة ثانية." };
  }

  revalidatePath("/ambassadors");
  return { ok: "تم إرسال طلبك! فريقنا يراجعه ويردّ عليك قريبًا." };
}
