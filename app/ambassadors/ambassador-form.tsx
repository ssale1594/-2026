"use client";

import { useActionState } from "react";
import { applyAsAmbassador, type AmbassadorFormState } from "./actions";

const initialState: AmbassadorFormState = {};

export default function AmbassadorForm({
  neighborhoods,
}: {
  neighborhoods: { id: number; name_ar: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    applyAsAmbassador,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-rose-500/10 text-rose-800 dark:text-rose-200 px-4 py-3 text-sm">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 px-4 py-3 text-sm">
          {state.ok}
        </p>
      )}

      <label className="block">
        <span className="block text-sm font-semibold mb-1.5">حيّك</span>
        <select
          name="neighborhoodId"
          required
          className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        >
          <option value="">— اختر الحي —</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name_ar}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-semibold mb-1.5">
          ليش تحب تكون سفير حيّك؟{" "}
          <span className="font-normal opacity-60">(اختياري)</span>
        </span>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="مثال: أعرف أغلب المحلات والأسر المنتجة بحينا وأحب أساعدهم ينضمّون"
          className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "جاري الإرسال..." : "أرسل طلبي"}
      </button>
    </form>
  );
}
