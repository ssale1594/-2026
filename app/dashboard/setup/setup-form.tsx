"use client";

import { useActionState } from "react";
import { createSellerProfile, type SetupFormState } from "./actions";

const initialState: SetupFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

const BUSINESS_TYPES = [
  { value: "shop", label: "محل تجاري" },
  { value: "home_producer", label: "أسرة منتجة" },
  { value: "service_provider", label: "مقدم خدمة" },
  { value: "real_estate_agent", label: "مكتب عقار" },
  { value: "individual", label: "فرد" },
];

export default function SetupForm({
  referralCode = "",
}: {
  referralCode?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createSellerProfile,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">اسم النشاط</span>
        <input name="businessName" required maxLength={80} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">نوع النشاط</span>
        <select name="businessType" required className={fieldClass}>
          <option value="">اختر النوع</option>
          {BUSINESS_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">رقم واتساب</span>
        <input
          name="whatsappNumber"
          required
          inputMode="tel"
          placeholder="05xxxxxxxx"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">نبذة عن النشاط</span>
        <textarea name="description" rows={4} maxLength={1000} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">كود دعوة — اختياري</span>
        <input
          name="referralCode"
          defaultValue={referralCode}
          maxLength={12}
          placeholder="لو أحد البائعين دعاك"
          className={fieldClass}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الحفظ..." : "إنشاء الحساب"}
      </button>
    </form>
  );
}
