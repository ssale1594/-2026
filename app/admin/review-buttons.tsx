"use client";

import { useState, useTransition } from "react";

export default function ReviewButtons({
  onApprove,
  onReject,
  // Default to the admin review-queue wording; the seller's transaction queue
  // reuses this component with its own labels ("أكّد" / "ما تعاملت معه").
  approveLabel = "اعتماد",
  rejectLabel = "رفض",
}: {
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The admin actions now throw instead of failing silently, so the failure has
  // to land somewhere the admin can see. Without this an unhandled rejection in
  // a transition takes down the whole route with a generic error screen.
  const run = (action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل الإجراء — جرّب مرة ثانية.");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() => run(onApprove)}
          className="rounded-lg bg-green-600 text-white text-sm px-3 py-1.5 disabled:opacity-50"
        >
          {approveLabel}
        </button>
        <button
          disabled={isPending}
          onClick={() => run(onReject)}
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm px-3 py-1.5 disabled:opacity-50"
        >
          {rejectLabel}
        </button>
      </div>
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 max-w-[16rem] text-left">
          {error}
        </p>
      )}
    </div>
  );
}
