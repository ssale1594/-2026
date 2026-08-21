"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitNeedRequest, type NeedRequestFormState } from "../actions";

const initialState: NeedRequestFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function NeedForm({
  categories,
  neighborhoods,
}: {
  categories: { id: number; name_ar: string }[];
  neighborhoods: { id: number; name_ar: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    submitNeedRequest,
    initialState
  );

  if (state.success) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-green-700 dark:text-green-500">
          نُشر طلبك. البائعون المناسبون بالزلفي بيشوفونه وبيتواصلون معك على
          واتساب مباشرة.
        </p>
        <Link href="/needs" className="text-sm underline">
          عرض كل الطلبات
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">وش تحتاج؟</span>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="مثال: أبي مصور لحفلة تخرج"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">تفاصيل أكثر — اختياري</span>
        <textarea
          name="description"
          rows={4}
          maxLength={1000}
          placeholder="الوقت المناسب، الميزانية التقريبية، أي تفاصيل تساعد البائع يرد عليك بدقة."
          className={fieldClass}
        />
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

      <label className="flex flex-col gap-1">
        <span className="text-sm">رقم واتساب للتواصل معك</span>
        <input
          name="contactWhatsapp"
          required
          inputMode="tel"
          placeholder="05xxxxxxxx"
          className={fieldClass}
        />
        <span className="text-xs text-black/40 dark:text-white/40">
          راح يظهر للبائعين عشان يتواصلون معك مباشرة.
        </span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ النشر..." : "انشر طلبي"}
      </button>
    </form>
  );
}
