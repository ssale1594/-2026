"use client";

import { useActionState } from "react";
import { upsertDirectoryEntry, type DirectoryFormState } from "./actions";

const initialState: DirectoryFormState = {};

export default function DirectoryForm({
  categories,
  neighborhoods,
}: {
  categories: { id: number; name_ar: string }[];
  neighborhoods: { id: number; name_ar: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    upsertDirectoryEntry,
    initialState
  );

  return (
    <form
      action={formAction}
      className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold">➕ إضافة محل للدليل العام</h2>

      {state.error && (
        <p className="rounded-lg bg-rose-500/10 text-rose-800 dark:text-rose-200 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 px-3 py-2 text-sm">
          {state.ok}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <input
          name="businessName"
          required
          placeholder="اسم المحل *"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
        <select
          name="categoryId"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        >
          <option value="">— الفئة —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ar}
            </option>
          ))}
        </select>
        <select
          name="neighborhoodId"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        >
          <option value="">— الحي —</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name_ar}
            </option>
          ))}
        </select>
        <input
          name="phone"
          placeholder="رقم هاتف"
          dir="ltr"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
        <input
          name="whatsapp"
          placeholder="رقم واتساب"
          dir="ltr"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
        <input
          name="addressNote"
          placeholder="علامة مميزة للموقع"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
        <input
          name="latitude"
          placeholder="خط العرض (latitude)"
          dir="ltr"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
        <input
          name="longitude"
          placeholder="خط الطول (longitude)"
          dir="ltr"
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
      </div>

      <label className="block">
        <span className="block text-xs text-black/60 dark:text-white/60 mb-1">
          مصدر المعلومة * (مطلوب — تأكيد إنها من مصدر عام، مثل خرائط قوقل)
        </span>
        <input
          name="sourceNote"
          required
          placeholder="مثال: خرائط قوقل، معرفة شخصية بالمكان..."
          className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
      </label>

      <input type="hidden" name="status" value="published" />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "جاري الحفظ..." : "إضافة للدليل"}
      </button>
    </form>
  );
}
