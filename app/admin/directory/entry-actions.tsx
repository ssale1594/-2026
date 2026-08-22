"use client";

import { useState, useTransition } from "react";

export default function DirectoryEntryActions({
  status,
  onToggle,
}: {
  status: "published" | "hidden";
  onToggle: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await onToggle();
            } catch (err) {
              setError(err instanceof Error ? err.message : "فشل الإجراء.");
            }
          });
        }}
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm px-3 py-1.5 disabled:opacity-50"
      >
        {status === "published" ? "إخفاء" : "إظهار"}
      </button>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
