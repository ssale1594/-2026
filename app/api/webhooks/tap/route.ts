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

  // Look the payment up BEFORE claiming the idempotency key. Claiming it first
  // meant a webhook that arrived before startCheckout's payments insert had
  // committed (the Tap charge is created a few hundred ms earlier) burned the
  // event id on a 404 — Tap's retry then hit the unique violation, was answered
  // "duplicate", and the subscription stayed pending forever despite a real
  // payment. Returning 404 without an event row keeps the retry meaningful.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, subscription_id, seller_id")
    .eq("provider", "tap")
    .eq("provider_payment_id", chargeId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "payment not found" }, { status: 404 });
  }

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

  // Any failure from here on must release the idempotency key, otherwise the
  // retry Tap sends is swallowed as a duplicate and the state never converges.
  async function releaseEventKey() {
    await supabase
      .from("payment_events")
      .delete()
      .eq("provider", "tap")
      .eq("event_id", eventId);
  }

  if (status === "CAPTURED") {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: paymentError } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: now.toISOString() })
      .eq("id", payment.id);

    if (paymentError) {
      await releaseEventKey();
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    if (payment.subscription_id) {
      const { error: subscriptionError } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", payment.subscription_id);

      // The payment is already marked paid; leaving the subscription inactive
      // is the worst outcome here, so surface a 500 and let Tap retry.
      if (subscriptionError) {
        await releaseEventKey();
        return NextResponse.json(
          { error: subscriptionError.message },
          { status: 500 }
        );
      }
    }
  } else if (["FAILED", "DECLINED", "CANCELLED"].includes(status)) {
    const { error: paymentError } = await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id);

    if (paymentError) {
      await releaseEventKey();
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    if (payment.subscription_id) {
      const { error: subscriptionError } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", payment.subscription_id);

      if (subscriptionError) {
        await releaseEventKey();
        return NextResponse.json(
          { error: subscriptionError.message },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
