"use client";

import { useState, useTransition } from "react";
import { generateListingDraft } from "./ai-actions";

export type DraftFill = {
  title: string;
  description: string;
  categoryId: number;
  priceNote: string;
  priceMin: number | null;
  priceMax: number | null;
};

// اللوحة لا تُرسل الإعلان ولا تحفظ شيئًا — تملأ الحقول فقط، والبائع
// يراجع ويعدّل ثم يرسل بنفسه. مسودة تُنشر بلا مراجعة ليست ميزة.
export default function AiDraftPanel({
  enabled,
  disabledReason,
  onFill,
}: {
  enabled: boolean;
  disabledReason: string | null;
  onFill: (fill: DraftFill) => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.2] p-3 text-xs text-black/50 dark:text-white/50">
        ✍️ مساعد كتابة الإعلان جاهز لكنه غير مفعّل.
        {disabledReason && <> {disabledReason}</>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-sky-500/40 bg-sky-500/5 text-sky-800 dark:text-sky-200 text-sm font-medium px-4 py-3 text-right hover:bg-sky-500/10"
      >
        ✍️ ما تدري وش تكتب؟ صف سلعتك بكلمتين وخلّ المساعد يجهّز لك المسودة
      </button>
    );
  }

  function run() {
    setError(null);
    setNote(null);
    start(async () => {
      const res = await generateListingDraft(raw);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const d = res.draft;
      onFill({
        title: d.title,
        description: d.description,
        categoryId: d.category_id,
        priceNote: d.price_note,
        priceMin: d.suggested_price_min,
        priceMax: d.suggested_price_max,
      });
      const range =
        d.suggested_price_min != null && d.suggested_price_max != null
          ? ` · اقتراح السعر: ${d.suggested_price_min}–${d.suggested_price_max} ر.س`
          : "";
      setNote(
        `عبّأت الحقول — راجعها وعدّل قبل الإرسال.${range} (${res.usedToday}/${res.dailyLimit} اليوم)`
      );
    });
  }

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/[.05] p-4 space-y-3">
      <div className="text-sm font-medium">✍️ صف سلعتك بكلماتك</div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="مثال: عسل سدر أصلي من مناحلنا، ٥ كيلو، معبأ هذا الموسم"
        className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
      />

      {error && (
        <div className="text-xs text-red-700 dark:text-red-300">{error}</div>
      )}
      {note && (
        <div className="text-xs text-emerald-700 dark:text-emerald-300">
          {note}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={run}
          disabled={pending || raw.trim().length < 10}
          className="rounded-lg bg-foreground text-background text-xs font-medium px-4 py-2 disabled:opacity-50"
        >
          {pending ? "جارٍ التجهيز…" : "جهّز المسودة"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-xs px-4 py-2"
        >
          إخفاء
        </button>
      </div>

      <p className="text-[11px] text-black/50 dark:text-white/50">
        المسودة اقتراح — أنت مسؤول عن صحة ما تنشره. راجع الوصف والسعر قبل
        الإرسال.
      </p>
    </div>
  );
}
