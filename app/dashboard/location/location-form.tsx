"use client";

import { useActionState } from "react";
import { saveLocation, type LocationFormState } from "./actions";

const initialState: LocationFormState = {};

export default function LocationForm({
  initial,
  neighborhoods,
}: {
  initial: {
    latitude: number | null;
    longitude: number | null;
    address_note: string | null;
    phone: string | null;
    neighborhood_id: number | null;
  };
  neighborhoods: { id: number; name_ar: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveLocation, initialState);

  // Pre-fill with the stored pair rather than an empty box: the seller sees
  // what's saved, and re-submitting without touching it keeps it.
  const currentCoords =
    initial.latitude !== null && initial.longitude !== null
      ? `${initial.latitude}, ${initial.longitude}`
      : "";

  return (
    <form action={formAction} className="space-y-5">
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
        <span className="block text-sm font-semibold mb-1.5">
          موقع المحل على الخريطة
        </span>
        <input
          name="mapLink"
          defaultValue={currentCoords}
          placeholder="الصق رابط خرائط قوقل، أو: 26.2994, 44.8144"
          className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
          dir="ltr"
        />
        <span className="block text-xs text-black/55 dark:text-white/55 mt-1.5 leading-relaxed">
          افتح <b>خرائط قوقل</b> ← اضغط مطوّلًا على مكان محلك ← مشاركة ← نسخ
          الرابط، والصقه هنا.
          <br />
          لو الرابط قصير (maps.app.goo.gl) افتحه أول بالمتصفح ثم انسخ الرابط
          الكامل من شريط العنوان.
        </span>
      </label>

      <label className="block">
        <span className="block text-sm font-semibold mb-1.5">الحي</span>
        <select
          name="neighborhoodId"
          defaultValue={initial.neighborhood_id ?? ""}
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
          وصف الموقع <span className="font-normal opacity-60">(اختياري)</span>
        </span>
        <input
          name="addressNote"
          defaultValue={initial.address_note ?? ""}
          maxLength={300}
          placeholder="مثال: جنب مسجد الملك عبدالعزيز، الدور الأرضي"
          className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
        <span className="block text-xs text-black/55 dark:text-white/55 mt-1.5">
          علامة مميزة يعرفها أهل الحي — أنفع من العنوان الرسمي.
        </span>
      </label>

      <label className="block">
        <span className="block text-sm font-semibold mb-1.5">
          رقم للاتصال المباشر{" "}
          <span className="font-normal opacity-60">(اختياري)</span>
        </span>
        <input
          name="phone"
          defaultValue={initial.phone ?? ""}
          placeholder="0501234567"
          className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
          dir="ltr"
        />
        <span className="block text-xs text-black/55 dark:text-white/55 mt-1.5">
          يظهر كزر &quot;اتصال&quot;. اتركه فاضيًا لو تفضّل واتساب فقط.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "جاري الحفظ..." : "حفظ الموقع"}
      </button>
    </form>
  );
}
