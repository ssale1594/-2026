"use server";

import { redirect } from "next/navigation";
import { requireSeller, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createCharge } from "@/lib/payments/tap";
import { siteUrl } from "@/lib/seo";

export async function startCheckout() {
  const seller = await requireSeller();
  const user = await requireUser();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("id, monthly_price")
    .eq("is_active", true)
    .single();

  if (!plan || plan.monthly_price == null) {
    throw new Error("ما فيه خطة اشتراك فعّالة حاليًا");
  }

  const charge = await createCharge({
    amountSar: plan.monthly_price,
    sellerId: seller.id,
    sellerEmail: user.email ?? "",
    sellerName: seller.business_name,
    redirectUrl: `${siteUrl}/dashboard/subscription`,
    webhookUrl: `${siteUrl}/api/webhooks/tap`,
  });

  // Record the pending subscription/payment now so the webhook has a row to
  // update by provider_payment_id when it arrives — the webhook is the source
  // of truth for activating it, this insert only reserves the tracking row.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .insert({
      seller_id: seller.id,
      plan_id: plan.id,
      provider: "tap",
      status: "pending",
    })
    .select("id")
    .single();

  await supabase.from("payments").insert({
    seller_id: seller.id,
    subscription_id: subscription?.id ?? null,
    provider: "tap",
    provider_payment_id: charge.id,
    amount: plan.monthly_price,
    status: "pending",
  });

  if (!charge.transaction?.url) {
    throw new Error("Tap ما رجّع رابط دفع");
  }

  redirect(charge.transaction.url);
}
