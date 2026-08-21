"use server";

import { requireUser, requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  REPORT_REASONS,
  isValidReasonCode,
  type ReportTargetType,
} from "@/lib/validation/report";

export async function getReasonList() {
  return REPORT_REASONS;
}

export async function submitReport(
  targetType: ReportTargetType,
  targetId: number | string,
  reasonCode: string,
  details: string
) {
  const user = await requireUser();
  const supabase = await createClient();

  if (!isValidReasonCode(reasonCode)) {
    return { error: "اختر سببًا صالحًا من القائمة" };
  }
  if (!targetType || targetId === null || targetId === undefined || targetId === "") {
    return { error: "الهدف غير صالح" };
  }

  // target_id is text (migration 54). It used to be bigint, and this line used
  // to be Number(targetId) — which is NaN for a listing, whose id is a uuid.
  // Reporting a listing is the only place ReportDialog is actually used, so the
  // whole feature failed every time.
  const insQ = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: String(targetId),
    reason_code: reasonCode,
    details: details.slice(0, 2000),
  });
  if (insQ.error) return { error: insQ.error.message };

  return { ok: true };
}

export async function adminSetReportStatus(
  reportId: number,
  status: "reviewing" | "resolved" | "rejected" | "escalated" | "pending",
  resolution: string,
  actionTaken: string
) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const updQ = await supabase
    .from("content_reports")
    .update({
      status,
      resolution: resolution || null,
      action_taken: actionTaken || null,
      handled_by: admin.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (updQ.error) return { error: updQ.error.message };

  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function adminTakeDownListing(
  listingId: string,
  status = "archived",
  note = ""
) {
  await requireAdmin();
  const supabase = await createClient();

  // Goes through the RPC for the same reason as app/admin/actions.ts, and
  // because rejection_reason is revoked from `authenticated` (migration 54).
  const { error } = await supabase.rpc("admin_set_listing_status", {
    p_listing_id: listingId,
    p_status: status,
    p_reason:
      note ||
      "تمت إزالة هذا الإعلان من قبل الإدارة بناءً على بلاغ — تواصل مع الإدارة للحل.",
  });
  if (error) return { error: error.message };

  revalidatePath("/listing");
  revalidatePath("/search");
  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function adminWarnOrBanSeller(
  sellerId: string,
  mode: "warn" | "ban",
  note: string
) {
  await requireAdmin();

  if (mode === "warn") {
    return {
      ok: true,
      info:
        "تم تسجيل التحذير في الإجراء المتخذ. انسخ الرسالة التالية وأرسلها للبائع عبر واتساب: " +
        note,
    };
  }

  const supabase = await createClient();

  // This previously updated `profiles` with verification_status and
  // rejection_reason — both of which live on `sellers`, not `profiles`. It
  // failed with "column does not exist" on every ban. The RPC suspends the
  // seller and archives their published listings in one transaction.
  const { data: archivedCount, error } = await supabase.rpc("admin_ban_seller", {
    p_seller_id: sellerId,
    p_reason: note || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/seller");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/sellers");
  return {
    ok: true,
    info: `تم حظر البائع وأرشفة ${archivedCount ?? 0} إعلان.`,
  };
}
