import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared by /api/contact-click and /api/listing-view — both were identical
// request-parsing + RPC-call + response-shaping code, differing only in
// which RPC they call.
export async function recordInteraction(request: Request, rpcName: string) {
  const { listingId } = await request.json();

  if (typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpcName, { p_listing_id: listingId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
