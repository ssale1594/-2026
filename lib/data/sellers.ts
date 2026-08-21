import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SellerDetail = {
  id: string;
  business_name: string;
  business_type: string;
  description: string | null;
  whatsapp_number: string;
  slug: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  address_note: string | null;
  neighborhood_id: number | null;
};

export const getSellerBySlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("sellers")
    .select(
      "id, slug, business_name, business_type, description, whatsapp_number, phone, latitude, longitude, address_note, neighborhood_id"
    )
    .eq("slug", slug)
    .eq("verification_status", "approved")
    .single<SellerDetail>();

  return data;
});
