// Single source of truth for content-report reasons. This list used to exist
// verbatim in two places (components/report-dialog.tsx and
// app/admin/moderation/moderation-actions.ts) with slightly different wording,
// so the label a reporter saw and the label the admin panel validated against
// could drift apart.
//
// Plain module, not a "use client" one: the dialog imports it in the browser
// and the server action imports it on the server.

export const REPORT_REASONS = [
  {
    code: "spam",
    label: "رسائل مزعجة / سبام",
    desc: "محتوى مكرر أو ترويجي غير مرغوب فيه",
  },
  {
    code: "fraud",
    label: "نصب أو احتيال",
    desc: "بيانات وهمية، طلب تحويل مبلغ، أو بائع غير أمين",
  },
  {
    code: "inappropriate",
    label: "محتوى غير لائق",
    desc: "صور أو وصف مسيء أو مخالف للآداب",
  },
  {
    code: "wrong_price",
    label: "تسعير غير عادل",
    desc: "سعر مبالغ فيه أو خداع (مثل رسوم مخفية)",
  },
  {
    code: "wrong_category",
    label: "تصنيف خاطئ",
    desc: "الإعلان موجود في الفئة الخطأ",
  },
  {
    code: "duplicate",
    label: "إعلان مكرر",
    desc: "نفس المنتج مرفوع أكثر من مرة",
  },
  {
    code: "expired",
    label: "غير متاح / بيع",
    desc: "السلعة بيعت أو الخدمة انتهت ولم يُحذف الإعلان",
  },
  {
    code: "legal",
    label: "مخالفة قانونية",
    desc: "منتج غير مسموح ببيعه",
  },
  {
    code: "other",
    label: "سبب آخر",
    desc: "اكتب تفاصيل البلاغ في المربع أدناه",
  },
] as const;

export type ReportReasonCode = (typeof REPORT_REASONS)[number]["code"];

export const REPORT_TARGET_TYPES = [
  "listing",
  "seller",
  "review",
  "comment",
  "event",
  "job",
  "need",
  "offer",
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export function isValidReasonCode(code: string): code is ReportReasonCode {
  return REPORT_REASONS.some((r) => r.code === code);
}
