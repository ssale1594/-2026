"use client";

import { useState, useTransition } from "react";
import {
  sellerRespondOffer,
  offererCancel,
  buyerAcceptsCounter,
} from "./bids-actions";

export default function BidActions({
  offerId,
  status,
  currentOffer,
  counterPrice,
}: {
  offerId: number;
  status: string;
  currentOffer: number;
  counterPrice: number | null;
}) {
  const [showCounter, setShowCounter] = useState(false);
  const [cp, setCp] = useState<string>(
    counterPrice ? String(counterPrice) : String(Math.round(currentOffer * 1.1))
  );
  const [cm, setCm] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSellerResponder = ["pending", "countered"].includes(status);

  function act(
    kind: "accept" | "reject" | "counter" | "cancel" | "acceptCounter"
  ) {
    setMsg(null);
    startTransition(async () => {
      let r: any;
      if (kind === "cancel") r = await offererCancel(offerId);
      else if (kind === "acceptCounter") r = await buyerAcceptsCounter(offerId);
      else
        r = await sellerRespondOffer(
          offerId,
          kind,
          kind === "counter" ? Number(cp) : null,
          kind === "counter" ? cm : null
        );
      if (r?.error) setMsg({ err: r.error });
      else setMsg({ ok: "تم ✅" });
    });
  }

  return (
    <div className="mt-3">
      {isSellerResponder && !showCounter && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => act("accept")}
            disabled={isPending}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-1.5 disabled:opacity-50"
          >
            ✅ أوافق
          </button>
          <button
            onClick={() => setShowCounter(true)}
            disabled={isPending}
            className="rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold px-4 py-1.5 disabled:opacity-50"
          >
            🔄 عرض مضاد
          </button>
          <button
            onClick={() => act("reject")}
            disabled={isPending}
            className="rounded-full bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-sm font-bold px-4 py-1.5 disabled:opacity-50"
          >
            ❌ أرفض
          </button>
        </div>
      )}

      {showCounter && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 dark:bg-sky-950/30 p-4 space-y-3">
          <div className="font-bold text-sm">تقديم عرض مضاد</div>
          <div className="flex gap-2 flex-wrap">
            <label className="flex-1 min-w-[140px]">
              <span className="block text-xs opacity-70 mb-0.5">السعر المضاد (ر.س)</span>
              <input
                type="number"
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                className="w-full rounded-lg border border-sky-500/40 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-bold"
              />
            </label>
            <label className="flex-[2] min-w-[200px]">
              <span className="block text-xs opacity-70 mb-0.5">ملاحظة (اختياري)</span>
              <input
                value={cm}
                onChange={(e) => setCm(e.target.value.slice(0, 1000))}
                placeholder="مثال: السعر شامل الضمان 3 أشهر فقط"
                className="w-full rounded-lg border border-sky-500/40 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => act("counter")}
              disabled={isPending || !cp}
              className="rounded-lg bg-sky-600 text-white text-sm font-bold px-4 py-1.5 hover:bg-sky-700 disabled:opacity-50"
            >
              📤 إرسال العرض المضاد
            </button>
            <button
              onClick={() => setShowCounter(false)}
              className="rounded-lg text-sm px-3 py-1.5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
            >
              تراجع
            </button>
          </div>
        </div>
      )}

      {/* Actions for buyer end: cancel pending or accept counter */}
      {!isSellerResponder && status === "countered" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => act("acceptCounter")}
            disabled={isPending}
            className="rounded-full bg-emerald-600 text-white text-sm font-bold px-4 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
          >
            ✅ أوافق على العرض المضاد
          </button>
          <button
            onClick={() => act("cancel")}
            disabled={isPending}
            className="rounded-full border border-black/10 dark:border-white/10 text-sm font-bold px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            🚫 ألغي عرضي
          </button>
        </div>
      )}
      {!isSellerResponder && status === "pending" && (
        <button
          onClick={() => act("cancel")}
          disabled={isPending}
          className="rounded-full border border-black/10 dark:border-white/10 text-sm font-bold px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
        >
          🚫 إلغاء العرض
        </button>
      )}

      {msg && (
        <div
          className={[
            "mt-2 rounded-xl px-3 py-2 text-sm border",
            msg.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200",
          ].join(" ")}
        >
          {msg.ok ?? msg.err}
        </div>
      )}
    </div>
  );
}
