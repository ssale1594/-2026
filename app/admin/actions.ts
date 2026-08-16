"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

async function logAdminAction(
  adminId: string,
  action: string,
  targetType: "seller" | "listing" | "referral" | "offer",
  targetId: string | number
) {
  const supabase = await createClient();
  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: String(targetId),
  });
}

export async function setSellerVerification(
  sellerId: string,
  status: "approved" | "rejected"
) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  await supabase
    .from("sellers")
    .update({ verification_status: status })
    .eq("id", sellerId);

  await logAdminAction(admin.id, `seller_${status}`, "seller", sellerId);
  revalidatePath("/admin/sellers");
}

export async function setListingStatus(
  listingId: string,
  status: "published" | "rejected"
) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  await supabase
    .from("listings")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", listingId);

  await logAdminAction(admin.id, `listing_${status}`, "listing", listingId);
  revalidatePath("/admin/listings");
}

export async function setOfferStatus(
  offerId: number,
  status: "published" | "rejected"
) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  await supabase.from("offers").update({ status }).eq("id", offerId);

  await logAdminAction(admin.id, `offer_${status}`, "offer", offerId);
  revalidatePath("/admin/offers");
}

export async function setReferralStatus(
  referralId: number,
  status: "contacted" | "dismissed"
) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  await supabase.from("referrals").update({ status }).eq("id", referralId);

  await logAdminAction(admin.id, `referral_${status}`, "referral", referralId);
  revalidatePath("/admin/referrals");
}
