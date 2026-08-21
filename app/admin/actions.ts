"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

// Every write here goes through a SECURITY DEFINER RPC rather than a direct
// .update(), because migration 53 revoked UPDATE on the sensitive columns from
// `authenticated` — and an admin *is* `authenticated` in Supabase, so a direct
// update fails with 42501 no matter what the RLS policy says. The RPCs check
// is_admin() themselves and write the audit-log row in the same transaction,
// so a failed update can no longer leave a "done" entry behind in admin_actions
// (which is what happened while these were fire-and-forget .update() calls).
async function callAdminRpc(
  fn: string,
  args: Record<string, unknown>,
  paths: string[]
) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc(fn, args);

  // Surfacing this instead of swallowing it is the whole point: the previous
  // version returned silently on failure, so the page revalidated, the row was
  // unchanged, and the admin had no way to tell.
  if (error) {
    throw new Error(error.message);
  }

  paths.forEach((path) => revalidatePath(path));
}

export async function setSellerVerification(
  sellerId: string,
  status: "approved" | "rejected",
  reason?: string
) {
  await callAdminRpc(
    "admin_set_seller_verification",
    { p_seller_id: sellerId, p_status: status, p_reason: reason ?? null },
    ["/admin/sellers", "/", `/seller`]
  );
}

export async function setListingStatus(
  listingId: string,
  status: "published" | "rejected",
  reason?: string
) {
  await callAdminRpc(
    "admin_set_listing_status",
    { p_listing_id: listingId, p_status: status, p_reason: reason ?? null },
    ["/admin/listings", "/", "/search"]
  );
}

export async function setEventStatus(
  eventId: number,
  status: "published" | "rejected"
) {
  await callAdminRpc(
    "admin_set_event_status",
    { p_event_id: eventId, p_status: status },
    ["/admin/events", "/events"]
  );
}

export async function setJobStatus(
  jobId: number,
  status: "published" | "rejected"
) {
  await callAdminRpc(
    "admin_set_job_status",
    { p_job_id: jobId, p_status: status },
    ["/admin/jobs", "/jobs"]
  );
}

export async function setOfferStatus(
  offerId: number,
  status: "published" | "rejected"
) {
  await callAdminRpc(
    "admin_set_offer_status",
    { p_offer_id: offerId, p_status: status },
    ["/admin/offers", "/offers"]
  );
}

export async function setReferralStatus(
  referralId: number,
  status: "contacted" | "dismissed"
) {
  await callAdminRpc(
    "admin_set_referral_status",
    { p_referral_id: referralId, p_status: status },
    ["/admin/referrals"]
  );
}

export async function setQuestionStatus(
  questionId: number,
  status: "published" | "hidden"
) {
  await callAdminRpc(
    "admin_set_question_status",
    { p_question_id: questionId, p_status: status },
    ["/admin/moderation", "/ask"]
  );
}

export async function setAnswerStatus(
  answerId: number,
  status: "published" | "hidden"
) {
  await callAdminRpc(
    "admin_set_answer_status",
    { p_answer_id: answerId, p_status: status },
    ["/admin/moderation", "/ask"]
  );
}
