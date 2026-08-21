"use client";

import { useTransition } from "react";
import { archiveListing } from "./listings/[id]/edit/actions";

// Calling the Server Action directly (imported from a "use server" module)
// instead of receiving it as an inline prop from the Server Component parent —
// the inline-closure-in-.map() pattern hit a real production bug: "Event
// handlers cannot be passed to Client Component props" on /dashboard as soon
// as a seller had a listing to archive.
export default function ArchiveButton({ listingId }: { listingId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (confirm("تبي تأرشف هذا الإعلان؟ ما راح يظهر للزوار.")) {
          startTransition(() => archiveListing(listingId));
        }
      }}
      className="text-sm text-black/60 dark:text-white/60 hover:text-red-600 disabled:opacity-50"
    >
      أرشفة
    </button>
  );
}
