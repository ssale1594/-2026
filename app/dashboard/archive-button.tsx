"use client";

import { useTransition } from "react";

export default function ArchiveButton({
  onArchive,
}: {
  onArchive: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (confirm("تبي تأرشف هذا الإعلان؟ ما راح يظهر للزوار.")) {
          startTransition(() => onArchive());
        }
      }}
      className="text-sm text-black/60 dark:text-white/60 hover:text-red-600 disabled:opacity-50"
    >
      أرشفة
    </button>
  );
}
