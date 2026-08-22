"use server";

import { createClient } from "@/lib/supabase/server";

export type ClaimFormState = { error?: string; ok?: string };

export async function submitClaim(
  directoryEntryId: string,
  whatsapp: string,
  note: string
): Promise<ClaimFormState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_directory_claim", {
    p_directory_entry_id: Number(directoryEntryId),
    p_whatsapp: whatsapp.trim(),
    p_note: note.trim() || null,
  });

  if (error) {
    return { error: "ما قدرنا نرسل طلبك — جرّب مرة ثانية." };
  }

  return { ok: "تم إرسال طلبك! نتواصل معك قريبًا." };
}
