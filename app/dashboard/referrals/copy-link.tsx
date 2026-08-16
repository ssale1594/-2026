"use client";

import { useState } from "react";

export default function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="text-xs text-black/60 dark:text-white/60 break-all">
        {link}
      </code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard can be blocked (insecure context, permissions) — the
            // link is shown in full above, so the user can still copy manually.
          }
        }}
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-xs px-3 py-1.5 shrink-0"
      >
        {copied ? "تم النسخ" : "نسخ الرابط"}
      </button>
    </div>
  );
}
