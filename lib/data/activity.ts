import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SellerActivity = {
  last_active_at: string | null;
  is_recently_active: boolean;
  responses_30d: number;
  avg_response_hours: number | null;
  contact_clicks_30d: number;
};

export const getSellerActivity = cache(async (sellerId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("seller_activity", {
    p_seller_id: sellerId,
  });
  return ((data as SellerActivity[] | null) ?? [])[0] ?? null;
});
