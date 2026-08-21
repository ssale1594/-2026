"use client";

import { useState, useTransition } from "react";

export default function AmbassadorActions({
  onApprove,
  onRevoke,
}: {
  onApprove: () => Promise<void>;
  onRevoke: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل الإجراء.");
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
          اعتماد
        </button>
        <button
          disabled={isPending}
          onClick={() => run(onRevoke)}
          className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm px-3 py-1.5 disabled:opacity-50"
        >
          رفض/إلغاء
        </button>
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
