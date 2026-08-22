"use client";

import { useActionState, useState } from "react";
import { createListing, type ListingFormState } from "./actions";
import AiDraftPanel, { type DraftFill } from "./ai-draft-panel";

const initialState: ListingFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function NewListingForm({
  categories,
  neighborhoods,
  aiEnabled = false,
  aiDisabledReason = null,
}: {
  categories: { id: number; name_ar: string }[];
  neighborhoods: { id: number; name_ar: string }[];
  aiEnabled?: boolean;
  aiDisabledReason?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    createListing,
    initialState
  );

  // الحقول محكومة ليقدر المساعد يملأها؛ القيم تبقى قابلة للتعديل
  // يدويًا بالكامل بعد التعبئة.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceHint, setPriceHint] = useState<string | null>(null);

  function applyDraft(fill: DraftFill) {
    setTitle(fill.title);
    setDescription(fill.description);
    setCategoryId(String(fill.categoryId));
    setPriceHint(fill.priceNote || null);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AiDraftPanel
        enabled={aiEnabled}
        disabledReason={aiDisabledReason}
        onFill={applyDraft}
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm">عنوان الإعلان</span>
        <input
          name="title"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الفئة</span>
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={fieldClass}
        >
          <option value="">اختر الفئة</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_ar}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الحي — اختياري</span>
        <select name="neighborhoodId" className={fieldClass}>
          <option value="">بدون تحديد حي</option>
          {neighborhoods.map((neighborhood) => (
            <option key={neighborhood.id} value={neighborhood.id}>
              {neighborhood.name_ar}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الوصف</span>
        <textarea
          name="description"
          rows={5}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">السعر (ر.س) — اختياري</span>
        {priceHint && (
          <span className="text-[11px] text-sky-700 dark:text-sky-300">
            {priceHint}
          </span>
        )}
        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2">
        <input name="priceNegotiable" type="checkbox" />
        <span className="text-sm">السعر قابل للتفاوض</span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الحفظ..." : "إرسال للمراجعة"}
      </button>
    </form>
  );
}
