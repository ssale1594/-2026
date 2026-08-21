"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { sponsorshipInputSchema } from "@/lib/validation/sponsorship";

export type SponsorshipFormState = { error?: string; success?: boolean };

export async function createSponsorship(
  _prevState: SponsorshipFormState,
  formData: FormData
): Promise<SponsorshipFormState> {
  await requireAdmin();

  const rawTargetId = formData.get("targetId");
  const parsed = sponsorshipInputSchema.safeParse({
    sponsorName: formData.get("sponsorName"),
    sponsorUrl: formData.get("sponsorUrl") || undefined,
    message: formData.get("message") || undefined,
    targetType: formData.get("targetType"),
    targetId:
      rawTargetId === "" || rawTargetId === null ? undefined : rawTargetId,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sponsorships").insert({
    sponsor_name: parsed.data.sponsorName,
    sponsor_url: parsed.data.sponsorUrl || null,
    message: parsed.data.message ?? null,
    target_type: parsed.data.targetType,
    // The DB check constraint requires target_id to be null for 'home'.
    target_id: parsed.data.targetType === "home" ? null : parsed.data.targetId,
    starts_at: new Date(parsed.data.startsAt).toISOString(),
    ends_at: new Date(parsed.data.endsAt).toISOString(),
  });

  if (error) {
    return { error: "ما قدرنا نحفظ الرعاية — تأكد من البيانات وجرّب مرة ثانية." };
  }

  revalidatePath("/admin/sponsorships");
  return { success: true };
}

export async function deactivateSponsorship(sponsorshipId: number) {
  await requireAdmin();
  const supabase = await createClient();

  await supabase
    .from("sponsorships")
    .update({ is_active: false })
    .eq("id", sponsorshipId);

  revalidatePath("/admin/sponsorships");
}
