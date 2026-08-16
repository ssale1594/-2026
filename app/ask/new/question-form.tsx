"use client";

import { useActionState } from "react";
import { askQuestion, type QuestionFormState } from "../actions";

const initialState: QuestionFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function QuestionForm({
  categories,
  neighborhoods,
}: {
  categories: { id: number; name_ar: string }[];
  neighborhoods: { id: number; name_ar: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    askQuestion,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">سؤالك</span>
        <input
          name="title"
          required
          maxLength={150}
          placeholder="مثال: مين يعرف كهربائي شاطر بالزلفي؟"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">تفاصيل — اختياري</span>
        <textarea name="body" rows={4} maxLength={1000} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">القسم — اختياري</span>
        <select name="categoryId" className={fieldClass}>
          <option value="">أي قسم</option>
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
          <option value="">أي حي</option>
          {neighborhoods.map((neighborhood) => (
            <option key={neighborhood.id} value={neighborhood.id}>
              {neighborhood.name_ar}
            </option>
          ))}
        </select>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ النشر..." : "انشر سؤالي"}
      </button>
    </form>
  );
}
