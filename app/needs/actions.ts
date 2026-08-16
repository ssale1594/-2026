"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { needRequestSchema } from "@/lib/validation/need-request";
import { visitorHash } from "@/lib/visitor-hash";

export type NeedRequestFormState = { error?: string; success?: boolean };

export async function submitNeedRequest(
  _prevState: NeedRequestFormState,
  formData: FormData
): Promise<NeedRequestFormState> {
  const rawCategoryId = formData.get("categoryId");
  const rawNeighborhoodId = formData.get("neighborhoodId");

  const parsed = needRequestSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    categoryId:
      rawCategoryId === "" || rawCategoryId === null ? undefined : rawCategoryId,
    neighborhoodId:
      rawNeighborhoodId === "" || rawNeighborhoodId === null
        ? undefined
        : rawNeighborhoodId,
    contactWhatsapp: formData.get("contactWhatsapp"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const hash = await visitorHash();

  // Checked here for a clear message; the cap exists mainly to keep one visitor
  // from flooding the public needs board.
  const { data: withinLimit } = await supabase.rpc("can_post_need_request", {
    p_visitor_hash: hash,
  });

  if (withinLimit === false) {
    return { error: "وصلت الحد الأقصى للطلبات اليوم (3 طلبات). جرّب بكرة." };
  }

  const { error } = await supabase.from("need_requests").insert({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    category_id: parsed.data.categoryId ?? null,
    neighborhood_id: parsed.data.neighborhoodId ?? null,
    contact_whatsapp: parsed.data.contactWhatsapp,
    visitor_hash: hash,
    status: "open",
  });

  if (error) {
    return { error: "ما قدرنا نحفظ طلبك — جرّب مرة ثانية." };
  }

  revalidatePath("/needs");
  return { success: true };
}
