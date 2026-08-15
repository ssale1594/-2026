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

  // Carrying the already-resolved user avoids a second supabase.auth.getUser()
  // round trip in callers that need both (e.g. the seller's email for checkout).
  return { ...seller, email: user.email };
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();

  // Calls the same is_admin() the RLS policies use (see
  // supabase/migrations/00000000000005_fix_admin_policy_recursion.sql)
  // instead of re-reading profiles.role independently, so "admin" is defined
  // in exactly one place for both the DB and app layers.
  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    redirect("/");
  }

  return user;
}
