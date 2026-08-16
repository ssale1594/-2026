"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function setTransactionStatus(
  transactionId: number,
  status: "confirmed" | "disputed"
) {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({
      status,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .eq("id", transactionId)
    // Scoped by seller_id as well as RLS — the same belt-and-braces pattern the
    // listing actions use.
    .eq("seller_id", seller.id);

  if (error) {
    throw new Error("ما قدرنا نحدّث حالة التعامل — جرّب مرة ثانية.");
  }

  revalidatePath("/dashboard/transactions");
}
