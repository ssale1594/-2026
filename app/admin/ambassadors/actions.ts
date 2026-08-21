"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function setAmbassadorStatus(
  id: number,
  status: "approved" | "revoked"
) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_ambassador_status", {
    p_id: id,
    p_status: status,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/ambassadors");
  revalidatePath("/neighborhood");
}
