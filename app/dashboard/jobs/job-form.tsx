"use client";

import { useActionState } from "react";
import { createJob, type JobFormState } from "@/app/jobs/actions";

const initialState: JobFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function JobForm({
  neighborhoods,
}: {
  neighborhoods: { id: number; name_ar: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createJob, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 mb-10">
      <label className="flex flex-col gap-1">
        <span className="text-sm">المسمى الوظيفي</span>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="مثال: كاشير بدوام جزئي"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الوصف والمتطلبات — اختياري</span>
        <textarea name="description" rows={4} maxLength={1500} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">نوع الدوام</span>
        <select name="jobType" required defaultValue="full_time" className={fieldClass}>
          <option value="full_time">دوام كامل</option>
          <option value="part_time">دوام جزئي</option>
          <option value="temporary">مؤقت</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الراتب — اختياري</span>
        <input
          name="salaryText"
          maxLength={80}
          placeholder="مثال: 4000 ر.س أو حسب الخبرة"
          className={fieldClass}
        />
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
      {state.success && (
        <p className="text-sm text-green-700 dark:text-green-500">
          أرسلنا الوظيفة للمراجعة.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الإرسال..." : "إرسال الوظيفة للمراجعة"}
      </button>
    </form>
  );
}
