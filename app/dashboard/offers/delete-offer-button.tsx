"use client";

import { useTransition } from "react";

export default function DeleteOfferButton({
  onDelete,
}: {
  onDelete: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => onDelete())}
      className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-sm px-3 py-1.5 disabled:opacity-50 shrink-0"
    >
      حذف
    </button>
  );
}
