"use client";

import { useActionState } from "react";
import { submitReferral, type ReferralFormState } from "./actions";

const initialState: ReferralFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

export default function ReferForm() {
  const [state, formAction, isPending] = useActionState(
    submitReferral,
    initialState
  );

  if (state.success) {
    return (
      <p className="text-sm text-green-700 dark:text-green-500">
        وصلنا ترشيحك، وبنتواصل مع صاحب النشاط قريبًا. شكرًا لك!
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">اسم النشاط أو الأسرة المنتجة</span>
        <input
          name="businessName"
          required
          maxLength={120}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">وش يقدمون؟ — اختياري</span>
        <textarea
          name="businessDescription"
          rows={3}
          maxLength={500}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">رقم واتساب النشاط — اختياري</span>
        <input
          name="businessWhatsapp"
          inputMode="tel"
          placeholder="05xxxxxxxx"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">اسمك — اختياري</span>
        <input name="referrerName" maxLength={80} className={fieldClass} />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الإرسال..." : "رشّحه"}
      </button>
    </form>
  );
}
