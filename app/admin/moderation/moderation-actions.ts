"use server";

import { requireUser, requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const REASONS: { code: string; label: string; desc: string }[] = [
  { code: "spam", label: "رسائل مزعجة / سبام", desc: "محتوى مكرر أو ترويجي غير مرغوب فيه" },
  { code: "fraud", label: "نصب أو احتيال", desc: "بيانات وهمية، طلب تحويل مبلغ، أو بائع غير أمين" },
  { code: "inappropriate", label: "محتوى غير لائق", desc: "صور/وصف للكبار فقط أو مسيء أو مخالف للآداب" },
  { code: "wrong_price", label: "تسعير غير عادل", desc: "السعر مبالغ فيه أو خداع (مثل سعر الشحن مخفي)" },
  { code: "wrong_category", label: "تصنيف خاطئ", desc: "الإعلان موجود في الفئة الخطأ" },
  { code: "duplicate", label: "إعلان مكرر", desc: "نفس المنتج مرفوع أكثر من مرة" },
  { code: "expired", label: "غير متاح / بيع", desc: "السلعة بيعت أو الخدمة انتهت ولم يُحذف الإعلان" },
  { code: "legal", label: "مخالفة قانونية", desc: "منتج غير مسموح ببيعه أو يخاطر الشريعة/القانون" },
  { code: "other", label: "سبب آخر", desc: "اكتب تفاصيل البلاغ في المربع أدناه" },
];

export async function getReasonList() {
  return REASONS;
}

export async function submitReport(
  targetType:
    | "listing"
    | "seller"
    | "review"
    | "comment"
    | "event"
    | "job"
    | "need"
    | "offer",
  targetId: number | string,
  reasonCode: string,
  details: string
) {
  const user = await requireUser();
  const supabase = await createClient();

  if (!REASONS.find((r) => r.code === reasonCode)) {
    return { error: "اختر سببًا صالحًا من القائمة" };
  }
  if (!targetType || !targetId) return { error: "الهدف غير صالح" };

  const insQ = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: typeof targetId === "string" ? Number(targetId) : targetId,
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
  await requireAdmin();
  const supabase = await createClient();
  const { data: adminRow }: any = await supabase.auth.getUser();
  const adminId = adminRow?.user?.id;

  const updQ = await supabase
    .from("content_reports")
    .update({
      status,
      resolution: resolution || null,
      action_taken: actionTaken || null,
      handled_by: adminId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (updQ.error) return { error: updQ.error.message };

  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function adminTakeDownListing(listingId: string, status = "archived", note = "") {
  await requireAdmin();
  const supabase = await createClient();
  const updQ = await supabase
    .from("listings")
    .update({
      status,
      rejection_reason:
        note ||
        "تمت إزالة هذا الإعلان من قبل الإدارة بناءً على تقرير مُقدّم - يرجى التواصل مع الإدارة للحل.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId);
  if (updQ.error) return { error: updQ.error.message };
  revalidatePath(`/listing`);
  revalidatePath(`/search`);
  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function adminWarnOrBanSeller(
  sellerId: string,
  mode: "warn" | "ban",
  note: string
) {
  await requireAdmin();
  const supabase = await createClient();
  if (mode === "ban") {
    const updQ = await supabase
      .from("profiles")
      .update({
        verification_status: "rejected",
        rejection_reason: note || "حظر من قبل الإدارة بناءً على تقارير المحتوى.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sellerId);
    if (updQ.error) return { error: updQ.error.message };
    // أرشفة كل إعلاناته
    await supabase
      .from("listings")
      .update({
        status: "archived",
        rejection_reason: "أرشفة تلقائية بسبب حظر الحساب.",
        updated_at: new Date().toISOString(),
      })
      .eq("seller_id", sellerId)
      .eq("status", "published");
  } else {
    // Warn: note gets added via action_taken in moderation row (we don't have warn column, using update message is enough)
    return {
      ok: true,
      info: "تم تسجيل التحذير في الإجراء المتخذ. انسخ الرسالة التالية وأرسلها للبائع عبر واتساب: " + note,
    };
  }
  revalidatePath(`/seller`);
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/sellers");
  return { ok: true };
}
