"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type VouchState = { error?: string; success?: boolean };

export async function vouchForSeller(sellerId: string): Promise<VouchState> {
  const user = await requireUser();

  if (user.id === sellerId) {
    return { error: "ما تقدر توصّي بنفسك." };
  }

  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("sellers")
    .select("slug")
    .eq("id", sellerId)
    .single<{ slug: string }>();

  const { error } = await supabase.from("vouches").insert({
    seller_id: sellerId,
    voucher_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "سبق ووصّيت بهذا البائع." };
    }
    return { error: "ما قدرنا نحفظ التوصية — جرّب مرة ثانية." };
  }

  if (seller) {
    revalidatePath(`/seller/${seller.slug}`);
  }

  return { success: true };
}
