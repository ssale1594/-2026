import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { visitorHashFromRequest } from "@/lib/visitor-hash";

// Seller-level contact tracking, for the buttons that aren't attached to a
// single listing: the WhatsApp/phone/directions buttons on /seller/[slug] and
// on the map directory. /api/contact-click only handles listing-scoped clicks.
export async function POST(request: Request) {
  const { sellerId, channel } = await request.json();

  if (typeof sellerId !== "string") {
    return NextResponse.json({ error: "sellerId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_seller_contact_click", {
    p_seller_id: sellerId,
    p_channel: typeof channel === "string" ? channel : "whatsapp",
    p_visitor_hash: visitorHashFromRequest(request),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
