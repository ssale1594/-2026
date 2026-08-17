"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sellerUpdateBookingStatus,
  buyerCancelBooking,
} from "@/app/dashboard/schedule/booking-actions";

type Status = "confirmed" | "completed" | "cancelled" | "no_show";

// Shared by the seller board and the buyer's list — the buyer only ever gets
// the cancel branch, so there is one component instead of two near-copies.
export default function BookingActions({
  bookingId,
  status,
  as,
}: {
  bookingId: number;
  status: string;
  as: "seller" | "buyer";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");

  function run(fn: () => Promise<{ error?: string } | { ok: true }>) {
    setError(null);
    start(async () => {
      const res = (await fn()) as any;
      if (res?.error) {
        setError(res.error);
        return;
      }
      setAskReason(false);
      setReason("");
      router.refresh();
    });
  }

  function setStatus(next: Status) {
    run(() => sellerUpdateBookingStatus(bookingId, next, reason || null));
  }

  const btn =
    "rounded-lg text-xs font-medium px-3 py-1.5 disabled:opacity-50 border";
  const cancelBtn = `${btn} border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-500/10`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {as === "seller" && status === "pending" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("confirmed")}
              className={`${btn} border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10`}
            >
              ✅ أكّد الموعد
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAskReason(true)}
              className={cancelBtn}
            >
              ⛔ اعتذر
            </button>
          </>
        )}

        {as === "seller" && status === "confirmed" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("completed")}
              className={`${btn} border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10`}
            >
              🎉 تم تنفيذه
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("no_show")}
              className={`${btn} border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10`}
            >
              🚫 ما حضر
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAskReason(true)}
              className={cancelBtn}
            >
              ⛔ ألغِ
            </button>
          </>
        )}

        {as === "buyer" && status === "pending" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setAskReason(true)}
            className={cancelBtn}
          >
            ⛔ ألغِ الحجز
          </button>
        )}
      </div>

      {askReason && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="سبب الإلغاء (اختياري)"
            className="flex-1 min-w-[200px] rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              as === "buyer"
                ? run(() => buyerCancelBooking(bookingId, reason || null))
                : setStatus("cancelled")
            }
            className={cancelBtn}
          >
            {pending ? "…" : "تأكيد الإلغاء"}
          </button>
          <button
            type="button"
            onClick={() => setAskReason(false)}
            className={`${btn} border-black/[.12] dark:border-white/[.2]`}
          >
            تراجع
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 dark:text-red-300">{error}</div>
      )}
    </div>
  );
}
