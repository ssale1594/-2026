"use server";

import { createClient } from "@/lib/supabase/server";

export type NewsletterFormState = { error?: string; ok?: string };

export async function subscribeToNewsletter(
  _prevState: NewsletterFormState,
  formData: FormData
): Promise<NewsletterFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "بريد إلكتروني غير صالح." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("newsletter_subscribe", {
    p_email: email,
  });

  if (error) {
    return { error: "ما قدرنا نسجّل اشتراكك — جرّب مرة ثانية." };
  }

  return { ok: "تم! بنرسل لك آخر الإعلانات كل أسبوع." };
}
