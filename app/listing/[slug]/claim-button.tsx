"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { claimTransaction, type ClaimState } from "@/app/my/actions";

export default function ClaimButton({
  listingId,
  sellerId,
  isSignedIn,
}: {
  listingId: string;
  sellerId: string;
  isSignedIn: boolean;
}) {
  const [state, setState] = useState<ClaimState>({});
  const [isPending, startTransition] = useTransition();

  if (!isSignedIn) {
    return (
      <p className="text-xs text-black/40 dark:text-white/40 mt-3">
        <Link href="/login" className="hover:underline">
          سجّل دخولك
        </Link>{" "}
        عشان تقدر توثّق تعاملك مع هذا البائع وتقيّمه.
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="text-xs text-green-700 dark:text-green-500 mt-3">
        سجّلنا تعاملك. بعد ما يأكده البائع تقدر تقيّمه من{" "}
        <Link href="/my/transactions" className="underline">
          صفحة تعاملاتك
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setState(await claimTransaction(listingId, sellerId));
          })
        }
        className="text-xs text-black/60 dark:text-white/60 hover:underline disabled:opacity-50"
      >
        {isPending ? "جارٍ التسجيل..." : "تعاملت مع هذا البائع"}
      </button>
      {state.error && (
        <p className="text-xs text-red-600 mt-1">{state.error}</p>
      )}
    </div>
  );
}
