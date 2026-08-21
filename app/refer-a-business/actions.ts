"use server";

import { createClient } from "@/lib/supabase/server";
import { referralInputSchema } from "@/lib/validation/referral";

export type ReferralFormState = { error?: string; success?: boolean };

export async function submitReferral(
  _prevState: ReferralFormState,
  formData: FormData
): Promise<ReferralFormState> {
  const parsed = referralInputSchema.safeParse({
    referrerName: formData.get("referrerName") || undefined,
    businessName: formData.get("businessName"),
    businessDescription: formData.get("businessDescription") || undefined,
    businessWhatsapp: formData.get("businessWhatsapp") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // No requireUser() here on purpose — anyone (including someone who isn't a
  // seller themselves) can suggest a business they know about.
  const { error } = await supabase.from("referrals").insert({
    referrer_name: parsed.data.referrerName ?? null,
    business_name: parsed.data.businessName,
    business_description: parsed.data.businessDescription ?? null,
    business_whatsapp: parsed.data.businessWhatsapp ?? null,
  });

  if (error) {
    return { error: "ما قدرنا نحفظ الترشيح — جرّب مرة ثانية." };
  }

  return { success: true };
}
