"use client";

import { useTransition } from "react";

// Receives the already-bound Server Action (see page.tsx: deleteSavedSearch.bind(null, id))
// instead of an inline closure passed as a custom prop — that pattern hit a real
// production bug ("Event handlers cannot be passed to Client Component props"),
// see app/dashboard/archive-button.tsx for the same fix applied first.
export default function DeleteSavedSearch({
  onDelete,
}: {
  onDelete: () => Promise<unknown>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          onDelete();
        })
      }
      className="text-xs text-black/50 dark:text-white/50 hover:underline disabled:opacity-40 shrink-0"
    >
      حذف
    </button>
  );
}
