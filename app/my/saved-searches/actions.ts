"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { savedSearchSchema } from "@/lib/validation/community";

export type SaveSearchState = { error?: string; success?: boolean };

export async function saveSearch(
  query: string,
  categoryId?: number
): Promise<SaveSearchState> {
  const user = await requireUser();

  const parsed = savedSearchSchema.safeParse({ query, categoryId });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  // normalized_query is filled by the DB trigger, so it can never drift from
  // the normalization the matcher uses.
  const { error } = await supabase.from("saved_searches").insert({
    user_id: user.id,
    query: parsed.data.query,
    normalized_query: parsed.data.query,
    category_id: parsed.data.categoryId ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "هذا البحث محفوظ عندك أصلًا." };
    }
    return { error: "ما قدرنا نحفظ البحث — جرّب مرة ثانية." };
  }

  revalidatePath("/my/saved-searches");
  return { success: true };
}

export async function deleteSavedSearch(savedSearchId: number) {
  const user = await requireUser();
  const supabase = await createClient();

  await supabase
    .from("saved_searches")
    .delete()
    .eq("id", savedSearchId)
    .eq("user_id", user.id);

  revalidatePath("/my/saved-searches");
}
