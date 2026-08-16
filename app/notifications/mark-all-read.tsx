"use client";

import { useTransition } from "react";
import { markAllRead } from "./actions";

export default function MarkAllRead({ disabled }: { disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={disabled || isPending}
      onClick={() => startTransition(() => markAllRead())}
      className="text-sm text-black/60 dark:text-white/60 hover:underline disabled:opacity-40"
    >
      تعليم الكل كمقروء
    </button>
  );
}
