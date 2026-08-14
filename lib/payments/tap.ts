import crypto from "crypto";

// Tap Payments Charges API (https://api.tap.company/v2/charges). Unverified
// against a live Tap account (TECH.md §7 requires confirming recurring-billing
// support with Tap in writing before relying on this in production) — the shape
// below follows Tap's public API docs but has not been exercised against a
// real merchant account yet. Re-check field names once real keys exist.
//
// Tap has no native "subscription" object like Stripe: a recurring plan here
// means charging the seller once, saving their card as a token, then charging
// that token again on renewal (a scheduled job, not built yet — out of scope
// until the first real payment works end to end).

const TAP_API_BASE = "https://api.tap.company/v2";

export type CreateChargeParams = {
  amountSar: number;
  sellerId: string;
  sellerEmail: string;
  sellerName: string;
  redirectUrl: string;
  webhookUrl: string;
};

export type TapCharge = {
  id: string;
  status: string;
  transaction?: { url?: string };
};

export async function createCharge(
  params: CreateChargeParams
): Promise<TapCharge> {
  const secretKey = process.env.TAP_SECRET_KEY;
  if (!secretKey) throw new Error("TAP_SECRET_KEY غير مضبوط");

  const response = await fetch(`${TAP_API_BASE}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountSar,
      currency: "SAR",
      customer_initiated: true,
      threeDSecure: true,
      save_card: true,
      description: "اشتراك شهري — سوق الزلفي",
      customer: {
        first_name: params.sellerName,
        email: params.sellerEmail,
      },
      source: { id: "src_all" },
      redirect: { url: params.redirectUrl },
      post: { url: params.webhookUrl },
      metadata: { seller_id: params.sellerId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Tap charge failed: ${response.status}`);
  }

  return response.json();
}

// Tap signs webhook payloads with HMAC-SHA256 over the raw body using the
// webhook secret from the dashboard. Verify against TAP_WEBHOOK_SECRET before
// trusting any webhook payload — never process an unverified webhook.
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const webhookSecret = process.env.TAP_WEBHOOK_SECRET;
  if (!webhookSecret || !signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);

  // timingSafeEqual throws on mismatched lengths instead of returning false.
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
