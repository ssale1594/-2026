"use client";

import { useState, useTransition } from "react";
import { submitClaim, type ClaimFormState } from "./claim-actions";

export default function ClaimButton({
  directoryEntryId,
  businessName,
}: {
  directoryEntryId: string;
  businessName: string;
}) {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<ClaimFormState>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!whatsapp.trim()) {
      setState({ error: "رقم واتساب مطلوب." });
      return;
    }
    setState({});
    startTransition(async () => {
      const result = await submitClaim(directoryEntryId, whatsapp, note);
      setState(result);
      if (result.ok) {
        setTimeout(() => setOpen(false), 2000);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded-full border border-sky-500/40 text-sky-700 dark:text-sky-300 px-3 py-1 hover:bg-sky-500/10"
      >
        هذا محلي — اطلب التحكم
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 text-black dark:text-white shadow-2xl border border-black/[.08] dark:border-white/[.145] p-5">
            <h3 className="font-bold mb-1">طلب تحكّم بـ{businessName}</h3>
            <p className="text-xs text-black/55 dark:text-white/55 mb-4">
              نتواصل معك بواتساب للتحقق ونساعدك تفعّل حسابك بالمنصة.
            </p>

            {state.error && (
              <p className="rounded-lg bg-rose-500/10 text-rose-800 dark:text-rose-200 px-3 py-2 text-sm mb-3">
                {state.error}
              </p>
            )}
            {state.ok && (
              <p className="rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 px-3 py-2 text-sm mb-3">
                {state.ok}
              </p>
            )}

            {!state.ok && (
              <div className="space-y-3">
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="رقم واتساب"
                  dir="ltr"
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="ملاحظة (اختياري)"
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-2 text-sm border border-black/[.12] dark:border-white/[.2]"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={submit}
                    disabled={pending}
                    className="rounded-lg px-4 py-2 text-sm font-bold bg-sky-600 text-white disabled:opacity-50"
                  >
                    {pending ? "جاري الإرسال..." : "إرسال الطلب"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
