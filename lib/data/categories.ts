import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CategoryDetail = { id: number; name_ar: string; slug: string };

export const getCategoryBySlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("categories")
    .select("id, name_ar, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<CategoryDetail>();

  return data;
});
