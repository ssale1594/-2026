"use client";

import { useActionState } from "react";
import { createListing, type ListingFormState } from "./actions";

const initialState: ListingFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function NewListingForm({
  categories,
}: {
  categories: { id: number; name_ar: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createListing,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">عنوان الإعلان</span>
        <input name="title" required maxLength={120} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الفئة</span>
        <select name="categoryId" required className={fieldClass}>
          <option value="">اختر الفئة</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_ar}
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
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">السعر (ر.س) — اختياري</span>
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
