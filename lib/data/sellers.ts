import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SellerDetail = {
  id: string;
  business_name: string;
  business_type: string;
  description: string | null;
  whatsapp_number: string;
};

export const getSellerBySlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("sellers")
    .select("id, business_name, business_type, description, whatsapp_number")
    .eq("slug", slug)
    .eq("verification_status", "approved")
    .single<SellerDetail>();

  return data;
});
