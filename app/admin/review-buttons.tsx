"use client";

import { useTransition } from "react";

export default function ReviewButtons({
  onApprove,
  onReject,
}: {
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 shrink-0">
      <button
        disabled={isPending}
        onClick={() => startTransition(() => onApprove())}
        className="rounded-lg bg-green-600 text-white text-sm px-3 py-1.5 disabled:opacity-50"
      >
        اعتماد
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => onReject())}
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm px-3 py-1.5 disabled:opacity-50"
      >
        رفض
      </button>
    </div>
  );
}
