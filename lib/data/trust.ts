import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SellerTrust = {
  level: number;
  label: string;
  identity_verified: boolean;
  vouch_count: number;
  confirmed_deals: number;
  average_rating: number | null;
};

// seller_trust() returns at most one row (and none for an unknown seller), so
// this collapses it to a nullable object for callers.
export const getSellerTrust = cache(async (sellerId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("seller_trust", { p_seller_id: sellerId });
  return ((data as SellerTrust[] | null) ?? [])[0] ?? null;
});
