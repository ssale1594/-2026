"use client";

import { useState, useTransition } from "react";
import { submitOffer } from "@/app/dashboard/bids/bids-actions";

export default function OfferButton({
  listingId,
  listingTitle,
  listingPrice,
  sellerId,
  compact = false,
}: {
  listingId: string;
  listingTitle?: string | null;
  listingPrice?: number | null;
  sellerId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<string>(listingPrice ? String(Math.max(1, Math.round(Number(listingPrice) * 0.8))) : "");
  const [message, setMessage] = useState<string>("");
  const [pending, setTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);

  function priceSuggestion(pct: number) {
    if (!listingPrice || listingPrice <= 0) return;
    setPrice(String(Math.max(1, Math.round(Number(listingPrice) * pct))));
  }

  function submit() {
    const pNum = Number(price);
    if (!pNum || pNum <= 0) {
      setMsg({ err: "أدخل سعراً صحيحاً للعرض." });
      return;
    }
    setMsg(null);
    setTransition(async () => {
      const res = await submitOffer({
        listingId,
        price: pNum,
        message: message || undefined,
      });
      if ((res as any).error) {
        setMsg({ err: (res as any).error });
      } else {
        setMsg({
          ok: "✅ أرسلنا عرضك للبائع! سيظهر له فوراً مع رد قبول/رفض/عرض مضاد. استعد للتواصل خلال 24 ساعة.",
        });
        setTimeout(() => {
          setOpen(false);
          setMsg(null);
        }, 1500);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
        }}
        className={[
          compact
            ? "rounded-xl bg-gradient-to-br from-fuchsia-600 to-rose-500 hover:from-fuchsia-700 hover:to-rose-600 text-white text-xs font-bold px-4 py-1.5 shadow-sm"
            : "rounded-xl bg-gradient-to-br from-fuchsia-600 to-rose-500 hover:from-fuchsia-700 hover:to-rose-600 text-white text-sm font-bold px-5 py-2.5 shadow-md inline-flex items-center gap-2",
        ].join(" ")}
      >
        {compact ? "💰 عرض سعر" : "💰 أقدم عرض سعر (تفاوض)"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-black/[.06] dark:border-white/[.08]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold inline-flex items-center gap-2">
                    💰 تقديم عرض سعر
                  </h3>
                  <p className="text-xs opacity-60 mt-1 max-w-sm">
                    ضع عرضك المالي على هذا الإعلان. البائع يستطيع القبول مباشرة،
                    أو الرفض مع سبب، أو تقديم عرض مضاد بسعر مختلف خلال 24 ساعة.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-2xl opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {listingTitle && (
                <div className="rounded-xl bg-black/[.03] dark:bg-white/[.05] px-3 py-2 text-sm">
                  <span className="opacity-60">عن الإعلان:</span>{" "}
                  <b className="line-clamp-1">{listingTitle}</b>
                </div>
              )}

              {listingPrice != null && listingPrice > 0 && (
                <div>
                  <div className="text-xs opacity-60 mb-1.5">اقتراح سريع بناءً على السعر المعلن ({listingPrice.toLocaleString("ar-SA")} ر.س):</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[0.7, 0.8, 0.9, 0.95].map((pct) => (
                      <button
                        type="button"
                        key={pct}
                        onClick={() => priceSuggestion(pct)}
                        className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 dark:bg-fuchsia-950/30 text-fuchsia-800 dark:text-fuchsia-200 px-2.5 py-0.5 text-xs font-bold hover:bg-fuchsia-500/20"
                      >
                        {Math.round(pct * 100)}% · {Math.round(Number(listingPrice) * pct).toLocaleString("ar-SA")} ر.س
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="block">
                <span className="block text-sm font-bold mb-1">
                  السعر الذي تقترحه (ر.س)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 text-lg font-bold bg-transparent"
                  placeholder="مثال: 280"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-semibold mb-1">
                  رسالة للبائع (اختياري)
                </span>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                  className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
                  placeholder="مثال: أستلم بنفسي من محلك، ضمان 3 أشهر على الأقل، نقد عند الاستلام..."
                />
                <div className="text-[10px] opacity-50 mt-0.5 text-left">
                  {message.length} / 1000 حرف
                </div>
              </label>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 px-3 py-2 text-xs">
                ⏱️ صلاحية العرض <b>24 ساعة</b>. لو لم يرد البائع خلالها ينتهي
                العرض تلقائياً وتقدر تُقدّم عرضاً جديداً.
              </div>

              {msg && (
                <div
                  className={[
                    "rounded-xl px-3 py-2 text-sm border",
                    msg.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
                  ].join(" ")}
                >
                  {msg.ok ?? msg.err}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-black/[.06] dark:border-white/[.08]">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm border border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                onClick={submit}
                disabled={pending || !price}
                className={[
                  "rounded-lg px-5 py-2 text-sm font-bold shadow",
                  pending || !price
                    ? "bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed"
                    : "bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white hover:from-fuchsia-700 hover:to-rose-600",
                ].join(" ")}
              >
                {pending ? "جارٍ الإرسال..." : "📩 أرسل العرض للبائع"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// silence sellerId (for now kept in signature for future)
export const __sellerId_silent = (_: string) => null;
