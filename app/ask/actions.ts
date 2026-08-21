"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { questionInputSchema, answerInputSchema } from "@/lib/validation/qa";

export type QuestionFormState = { error?: string };
export type AnswerFormState = { error?: string; success?: boolean };

export async function askQuestion(
  _prevState: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const user = await requireUser();

  const rawCategoryId = formData.get("categoryId");
  const rawNeighborhoodId = formData.get("neighborhoodId");

  const parsed = questionInputSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    categoryId:
      rawCategoryId === "" || rawCategoryId === null ? undefined : rawCategoryId,
    neighborhoodId:
      rawNeighborhoodId === "" || rawNeighborhoodId === null
        ? undefined
        : rawNeighborhoodId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({
      author_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      category_id: parsed.data.categoryId ?? null,
      neighborhood_id: parsed.data.neighborhoodId ?? null,
      status: "published",
    })
    .select("id")
    .single<{ id: number }>();

  if (error || !data) {
    return { error: "ما قدرنا ننشر سؤالك — جرّب مرة ثانية." };
  }

  revalidatePath("/ask");
  redirect(`/ask/${data.id}`);
}

export async function answerQuestion(
  questionId: number,
  _prevState: AnswerFormState,
  formData: FormData
): Promise<AnswerFormState> {
  const user = await requireUser();

  const parsed = answerInputSchema.safeParse({
    body: formData.get("body"),
    recommendedSellerId: formData.get("recommendedSellerId") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("answers").insert({
    question_id: questionId,
    author_id: user.id,
    body: parsed.data.body,
    recommended_seller_id: parsed.data.recommendedSellerId || null,
    status: "published",
  });

  if (error) {
    return { error: "ما قدرنا نحفظ ردك — جرّب مرة ثانية." };
  }

  revalidatePath(`/ask/${questionId}`);
  return { success: true };
}
