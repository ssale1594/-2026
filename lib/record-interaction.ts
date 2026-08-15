import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// HMAC instead of a bare hash so the visitor_hash column in interaction_log
// can never be reversed back to a raw IP by brute-forcing the small IPv4
// space — the secret makes that infeasible. Falls back to a fixed bucket
// when no secret is set (local dev without INTERACTION_HASH_SECRET), which
// only means dedup collapses onto one shared "visitor" locally; production
// must set this.
function visitorHash(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const secret = process.env.INTERACTION_HASH_SECRET ?? "dev-only-insecure-secret";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

// Shared by /api/contact-click and /api/listing-view — both were identical
// request-parsing + RPC-call + response-shaping code, differing only in
// which RPC they call.
export async function recordInteraction(request: Request, rpcName: string) {
  const { listingId } = await request.json();

  if (typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpcName, {
    p_listing_id: listingId,
    p_visitor_hash: visitorHash(request),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
