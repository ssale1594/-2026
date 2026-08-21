"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitEvent, type EventFormState } from "./actions";

const initialState: EventFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function EventForm({
  neighborhoods,
  isSignedIn,
}: {
  neighborhoods: { id: number; name_ar: string }[];
  isSignedIn: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    submitEvent,
    initialState
  );

  if (!isSignedIn) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        <Link href="/login" className="underline">
          سجّل دخولك
        </Link>{" "}
        عشان تضيف فعالية.
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="text-sm text-green-700 dark:text-green-500">
        أرسلنا فعاليتك للمراجعة — بتظهر بالتقويم بعد الاعتماد.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">عنوان الفعالية</span>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="مثال: بازار الأسر المنتجة"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">التفاصيل — اختياري</span>
        <textarea name="description" rows={3} maxLength={1000} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">المكان — اختياري</span>
        <input name="locationText" maxLength={150} className={fieldClass} />
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

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">يبدأ</span>
          <input
            name="startsAt"
            type="datetime-local"
            required
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">ينتهي — اختياري</span>
          <input name="endsAt" type="datetime-local" className={fieldClass} />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الإرسال..." : "إرسال الفعالية للمراجعة"}
      </button>
    </form>
  );
}
