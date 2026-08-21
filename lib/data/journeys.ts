import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type JourneyStep = {
  id: number;
  title_ar: string;
  search_query: string | null;
  category_id: number | null;
  sort_order: number;
};

export type JourneyDetail = {
  id: number;
  name_ar: string;
  slug: string;
  description: string | null;
};

export const getJourneys = cache(async () => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("journeys")
    .select("id, name_ar, slug, description")
    .eq("is_active", true)
    .order("sort_order")
    .returns<JourneyDetail[]>();

  return data ?? [];
});

export const getJourneyBySlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("journeys")
    .select("id, name_ar, slug, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<JourneyDetail>();

  return data;
});

export const getJourneySteps = cache(async (journeyId: number) => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("journey_steps")
    .select("id, title_ar, search_query, category_id, sort_order")
    .eq("journey_id", journeyId)
    .order("sort_order")
    .returns<JourneyStep[]>();

  return data ?? [];
});
