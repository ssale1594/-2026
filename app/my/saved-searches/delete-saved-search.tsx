"use client";

import { useTransition } from "react";

export default function DeleteSavedSearch({
  onDelete,
}: {
  onDelete: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => onDelete())}
      className="text-xs text-black/50 dark:text-white/50 hover:underline disabled:opacity-40 shrink-0"
    >
      حذف
    </button>
  );
}
