import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// TECH.md §12.5 — the seller is always resolved server-side from the session,
// never from an id sent by the client.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireSeller() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("sellers")
    .select("id, business_name, slug, verification_status, free_listing_limit, active_listings_count")
    .eq("id", user.id)
    .single();

  if (!seller) {
    redirect("/dashboard/setup");
  }

  return seller;
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return user;
}
