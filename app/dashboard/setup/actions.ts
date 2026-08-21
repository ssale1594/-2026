"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { sellerSetupSchema } from "@/lib/validation/listing";
import { uniqueSlug } from "@/lib/slug";

export type SetupFormState = { error?: string };

export async function createSellerProfile(
  _prevState: SetupFormState,
  formData: FormData
): Promise<SetupFormState> {
  const user = await requireUser();

  const parsed = sellerSetupSchema.safeParse({
    businessName: formData.get("businessName"),
    businessType: formData.get("businessType"),
    description: formData.get("description") || undefined,
    whatsappNumber: formData.get("whatsappNumber"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // sellers.id is the user id (see initial schema) — the row can only ever
  // belong to the signed-in user, enforced again by the sellers_insert_own policy.
  const { error } = await supabase.from("sellers").insert({
    id: user.id,
    business_name: parsed.data.businessName,
    business_type: parsed.data.businessType,
    slug: uniqueSlug(parsed.data.businessName),
    description: parsed.data.description ?? null,
    whatsapp_number: parsed.data.whatsappNumber,
    verification_status: "pending",
  });

  if (error) {
    return { error: "ما قدرنا ننشئ الحساب — جرّب مرة ثانية." };
  }

  // Attribution is best-effort: a bad or missing code must never block signup,
  // so a failure here is deliberately swallowed. claim_referral() re-validates
  // the code server-side and ignores self-referrals.
  const referralCode = formData.get("referralCode");
  if (typeof referralCode === "string" && referralCode.trim()) {
    await supabase.rpc("claim_referral", { p_code: referralCode.trim() });
  }

  redirect("/dashboard");
}
