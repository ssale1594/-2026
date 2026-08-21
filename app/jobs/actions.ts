"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { jobInputSchema, jobApplicationSchema } from "@/lib/validation/community";

export type JobFormState = { error?: string; success?: boolean };
export type ApplicationFormState = { error?: string; success?: boolean };

export async function createJob(
  _prevState: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const seller = await requireSeller();

  if (seller.verification_status !== "approved") {
    return { error: "حسابك لسا تحت المراجعة — ما تقدر تنشر وظائف بعد." };
  }

  const rawNeighborhoodId = formData.get("neighborhoodId");
  const parsed = jobInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    jobType: formData.get("jobType"),
    salaryText: formData.get("salaryText") || undefined,
    neighborhoodId:
      rawNeighborhoodId === "" || rawNeighborhoodId === null
        ? undefined
        : rawNeighborhoodId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert({
    seller_id: seller.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    job_type: parsed.data.jobType,
    salary_text: parsed.data.salaryText ?? null,
    neighborhood_id: parsed.data.neighborhoodId ?? null,
    status: "pending_review",
  });

  if (error) {
    return { error: "ما قدرنا نحفظ الوظيفة — جرّب مرة ثانية." };
  }

  revalidatePath("/dashboard/jobs");
  return { success: true };
}

export async function closeJob(jobId: number) {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { error } = await supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("id", jobId)
    .eq("seller_id", seller.id);

  if (error) {
    throw new Error("ما قدرنا نقفل الوظيفة — جرّب مرة ثانية.");
  }

  revalidatePath("/dashboard/jobs");
}

export async function applyToJob(
  jobId: number,
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const user = await requireUser();

  const parsed = jobApplicationSchema.safeParse({
    message: formData.get("message") || undefined,
    contactWhatsapp: formData.get("contactWhatsapp"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").insert({
    job_id: jobId,
    applicant_id: user.id,
    message: parsed.data.message ?? null,
    contact_whatsapp: parsed.data.contactWhatsapp,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "سبق وقدّمت على هذي الوظيفة." };
    }
    return { error: "ما قدرنا نرسل طلبك — جرّب مرة ثانية." };
  }

  revalidatePath("/jobs");
  return { success: true };
}
