import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type NeighborhoodDetail = { id: number; name_ar: string; slug: string };

// Sorted by name_ar (not id/created_at) since the list is long enough (26+)
// that a select/browse UI needs alphabetical order, not insertion order.
export const getNeighborhoods = cache(async () => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("neighborhoods")
    .select("id, name_ar, slug")
    .order("name_ar")
    .returns<NeighborhoodDetail[]>();

  return data ?? [];
});

export const getNeighborhoodBySlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("neighborhoods")
    .select("id, name_ar, slug")
    .eq("slug", slug)
    .single<NeighborhoodDetail>();

  return data;
});
