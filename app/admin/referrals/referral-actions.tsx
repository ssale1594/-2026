"use client";

import { useTransition } from "react";

export default function ReferralActions({
  onContacted,
  onDismiss,
}: {
  onContacted: () => Promise<void>;
  onDismiss: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 shrink-0">
      <button
        disabled={isPending}
        onClick={() => startTransition(() => onContacted())}
        className="rounded-lg bg-green-600 text-white text-sm px-3 py-1.5 disabled:opacity-50"
      >
        تواصلت معه
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => onDismiss())}
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm px-3 py-1.5 disabled:opacity-50"
      >
        تجاهل
      </button>
    </div>
  );
}
