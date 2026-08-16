import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ListingDetail = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_negotiable: boolean;
  updated_at: string;
  view_count: number;
  contact_click_count: number;
  categories: { name_ar: string; slug: string } | null;
  neighborhoods: { name_ar: string; slug: string } | null;
  sellers: { business_name: string; whatsapp_number: string; slug: string } | null;
  listing_images: { storage_path: string; is_primary: boolean; sort_order: number }[];
};

// React's cache() dedupes this within a single request, so generateMetadata
// and the page component share one Supabase round trip instead of two —
// they used to run the same lookup independently.
export const getListingBySlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("listings")
    .select(
      "id, title, description, price, price_negotiable, updated_at, view_count, contact_click_count, categories(name_ar, slug), neighborhoods(name_ar, slug), sellers(business_name, whatsapp_number, slug), listing_images(storage_path, is_primary, sort_order)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single<ListingDetail>();

  return data;
});
