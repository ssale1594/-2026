import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature } from "@/lib/payments/tap";

// This route needs to bypass RLS to update payments/subscriptions on behalf of
// any seller, and it authenticates via the webhook signature instead of a user
// session — a service-role client is the correct tool here, unlike every other
// route in this app which uses the session-scoped client from lib/supabase/server.
function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-tap-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const chargeId: string | undefined = event.id;
  const status: string | undefined = event.status;

  if (!chargeId || !status) {
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Idempotency (TECH.md §7): a single charge legitimately produces multiple
  // webhook deliveries with *different* statuses (e.g. INITIATED then
  // CAPTURED) — keying event_id on chargeId alone made the first delivery
  // "claim" that id and silently swallow every later status change,
  // including the real CAPTURED one. Keying on chargeId+status dedupes only
  // true repeat deliveries of the same event.
  const eventId = `${chargeId}:${status}`;
  const { error: eventInsertError } = await supabase
    .from("payment_events")
    .insert({ provider: "tap", event_id: eventId, event_type: status });

  if (eventInsertError) {
    // unique_violation on (provider, event_id) means we've already handled this one.
    if (eventInsertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: eventInsertError.message }, { status: 500 });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, subscription_id, seller_id")
    .eq("provider", "tap")
    .eq("provider_payment_id", chargeId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "payment not found" }, { status: 404 });
  }

  if (status === "CAPTURED") {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: now.toISOString() })
      .eq("id", payment.id);

    if (payment.subscription_id) {
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", payment.subscription_id);
    }
  } else if (["FAILED", "DECLINED", "CANCELLED"].includes(status)) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);

    if (payment.subscription_id) {
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", payment.subscription_id);
    }
  }

  return NextResponse.json({ ok: true });
}
