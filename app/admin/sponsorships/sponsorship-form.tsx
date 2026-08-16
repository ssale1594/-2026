"use client";

import { useActionState, useState } from "react";
import { createSponsorship, type SponsorshipFormState } from "./actions";

const initialState: SponsorshipFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function SponsorshipForm({
  categories,
  journeys,
}: {
  categories: { id: number; name_ar: string }[];
  journeys: { id: number; name_ar: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createSponsorship,
    initialState
  );
  const [targetType, setTargetType] = useState("home");

  const targetOptions = targetType === "category" ? categories : journeys;

  return (
    <form action={formAction} className="flex flex-col gap-4 mb-10">
      <label className="flex flex-col gap-1">
        <span className="text-sm">اسم الراعي</span>
        <input name="sponsorName" required maxLength={80} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">رابط الراعي — اختياري</span>
        <input
          name="sponsorUrl"
          type="url"
          placeholder="https://"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">رسالة قصيرة — اختياري</span>
        <input name="message" maxLength={120} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">مكان الرعاية</span>
        <select
          name="targetType"
          value={targetType}
          onChange={(event) => setTargetType(event.target.value)}
          className={fieldClass}
        >
          <option value="home">الصفحة الرئيسية</option>
          <option value="category">قسم</option>
          <option value="journey">رحلة احتياج</option>
        </select>
      </label>

      {targetType !== "home" && (
        <label className="flex flex-col gap-1">
          <span className="text-sm">
            {targetType === "category" ? "القسم" : "الرحلة"}
          </span>
          <select name="targetId" required className={fieldClass}>
            <option value="">اختر</option>
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name_ar}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">من تاريخ</span>
          <input name="startsAt" type="date" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">إلى تاريخ</span>
          <input name="endsAt" type="date" required className={fieldClass} />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-700 dark:text-green-500">
          تم حفظ الرعاية.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الحفظ..." : "إضافة رعاية"}
      </button>
    </form>
  );
}
