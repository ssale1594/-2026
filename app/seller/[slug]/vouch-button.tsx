"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { vouchForSeller, type VouchState } from "./vouch-actions";

export default function VouchButton({
  sellerId,
  isSignedIn,
  alreadyVouched,
  isSelf,
}: {
  sellerId: string;
  isSignedIn: boolean;
  alreadyVouched: boolean;
  isSelf: boolean;
}) {
  const [state, setState] = useState<VouchState>({});
  const [isPending, startTransition] = useTransition();

  if (isSelf) return null;

  if (!isSignedIn) {
    return (
      <p className="text-xs text-black/40 dark:text-white/40">
        <Link href="/login" className="hover:underline">
          سجّل دخولك
        </Link>{" "}
        عشان توصّي بهذا البائع لجيرانك.
      </p>
    );
  }

  if (alreadyVouched || state.success) {
    return (
      <p className="text-xs text-green-700 dark:text-green-500">
        وصّيت بهذا البائع.
      </p>
    );
  }

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setState(await vouchForSeller(sellerId));
          })
        }
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] text-xs px-3 py-1.5 disabled:opacity-50"
      >
        {isPending ? "جارٍ..." : "أوصّي بهذا البائع"}
      </button>
      {state.error && <p className="text-xs text-red-600 mt-1">{state.error}</p>}
    </div>
  );
}
