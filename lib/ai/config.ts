// مفتاح تشغيل مساعد كتابة الإعلانات.
//
// معطّل افتراضيًا عن قصد: استدعاء النموذج يكلّف مالًا، ومبدأ المشروع
// (TECH.md «مبدأ التكلفة») ألا ندفع قبل وجود دخل فعلي. الكود جاهز كاملًا،
// وتفعيله قرار صريح بضبط متغيّرَي البيئة أدناه — لا شيء يعمل بدونهما.
//
// للتفعيل لاحقًا:
//   ANTHROPIC_API_KEY=sk-ant-...
//   AI_LISTING_WRITER_ENABLED=1

export const AI_MODEL = "claude-opus-5";

// كتابة إعلان تصنيف وصياغة، لا استدلال معقّد — الجهد المتوسط يعطي
// جودة عربية جيدة بتكلفة أقل من الافتراضي (high).
export const AI_EFFORT = "medium" as const;

export function isListingWriterEnabled(): boolean {
  return (
    process.env.AI_LISTING_WRITER_ENABLED === "1" &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

// سبب التعطيل، لعرضه في الواجهة بدل زر ميت بلا تفسير.
export function listingWriterDisabledReason(): string | null {
  if (process.env.AI_LISTING_WRITER_ENABLED !== "1") {
    return "المساعد غير مفعّل على هذا الموقع.";
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return "المساعد مفعّل لكن مفتاح ANTHROPIC_API_KEY غير مضبوط.";
  }
  return null;
}
