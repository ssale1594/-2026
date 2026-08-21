"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type NotificationPrefs = {
  email_notifications_enabled: boolean;
  email_digest_enabled: boolean;
  notify_email_listing_published: boolean;
  notify_email_listing_rejected: boolean;
  notify_email_seller_approved: boolean;
  notify_email_seller_rejected: boolean;
  notify_email_transaction_claimed: boolean;
  notify_email_review_received: boolean;
  notify_email_vouch_received: boolean;
  notify_email_answer_received: boolean;
  notify_email_offer_published: boolean;
  notify_email_offer_rejected: boolean;
  notify_email_need_response: boolean;
};

export async function saveNotificationPrefs(prefs: NotificationPrefs) {
  const user = await requireUser();
  const supabase = await createClient();

  await supabase
    .from("profiles")
    .update({
      email_notifications_enabled: prefs.email_notifications_enabled,
      email_digest_enabled: prefs.email_digest_enabled,
      notify_email_listing_published: prefs.notify_email_listing_published,
      notify_email_listing_rejected: prefs.notify_email_listing_rejected,
      notify_email_seller_approved: prefs.notify_email_seller_approved,
      notify_email_seller_rejected: prefs.notify_email_seller_rejected,
      notify_email_transaction_claimed: prefs.notify_email_transaction_claimed,
      notify_email_review_received: prefs.notify_email_review_received,
      notify_email_vouch_received: prefs.notify_email_vouch_received,
      notify_email_answer_received: prefs.notify_email_answer_received,
      notify_email_offer_published: prefs.notify_email_offer_published,
      notify_email_offer_rejected: prefs.notify_email_offer_rejected,
      notify_email_need_response: prefs.notify_email_need_response,
    })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const user = await requireUser();
  const supabase = await createClient();

  const columns = [
    "email_notifications_enabled",
    "email_digest_enabled",
    "notify_email_listing_published",
    "notify_email_listing_rejected",
    "notify_email_seller_approved",
    "notify_email_seller_rejected",
    "notify_email_transaction_claimed",
    "notify_email_review_received",
    "notify_email_vouch_received",
    "notify_email_answer_received",
    "notify_email_offer_published",
    "notify_email_offer_rejected",
    "notify_email_need_response",
  ].join(", ");

  const { data, error } = await supabase
    .from("profiles")
    .select(columns)
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return {
      email_notifications_enabled: true,
      email_digest_enabled: true,
      notify_email_listing_published: true,
      notify_email_listing_rejected: true,
      notify_email_seller_approved: true,
      notify_email_seller_rejected: true,
      notify_email_transaction_claimed: true,
      notify_email_review_received: true,
      notify_email_vouch_received: true,
      notify_email_answer_received: true,
      notify_email_offer_published: true,
      notify_email_offer_rejected: true,
      notify_email_need_response: true,
    };
  }

  return data as unknown as NotificationPrefs;
}
