"use client";

import { useActionState } from "react";
import { createOffer, type OfferFormState } from "./actions";

const initialState: OfferFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function OfferForm({
  listings,
}: {
  listings: { id: string; title: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createOffer,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 mb-10">
      <label className="flex flex-col gap-1">
        <span className="text-sm">عنوان العرض</span>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="مثال: خصم 20% على كل الطلبات"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">تفاصيل — اختياري</span>
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">مرتبط بإعلان — اختياري</span>
        <select name="listingId" className={fieldClass}>
          <option value="">عرض عام (مو مرتبط بإعلان)</option>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">يبدأ</span>
          <input name="startsAt" type="date" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">ينتهي</span>
          <input name="endsAt" type="date" required className={fieldClass} />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-700 dark:text-green-500">
          أرسلنا عرضك للمراجعة — بيظهر بصفحة العروض بعد الاعتماد.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الإرسال..." : "إرسال العرض للمراجعة"}
      </button>
    </form>
  );
}
