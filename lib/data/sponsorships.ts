import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Sponsorship = {
  id: number;
  sponsor_name: string;
  sponsor_url: string | null;
  message: string | null;
};

// The RLS policy already filters to active + in-period rows, so callers get
// only a currently-running sponsorship without repeating the date logic here.
export const getSponsorship = cache(
  async (targetType: "home" | "category" | "journey", targetId?: number) => {
    const supabase = await createClient();

    let query = supabase
      .from("sponsorships")
      .select("id, sponsor_name, sponsor_url, message")
      .eq("target_type", targetType)
      .order("created_at", { ascending: false })
      .limit(1);

    query =
      targetId === undefined
        ? query.is("target_id", null)
        : query.eq("target_id", targetId);

    const { data } = await query.returns<Sponsorship[]>();

    return data?.[0] ?? null;
  }
);
