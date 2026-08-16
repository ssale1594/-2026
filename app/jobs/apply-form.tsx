"use client";

import Link from "next/link";
import { useActionState } from "react";
import { applyToJob, type ApplicationFormState } from "./actions";

const initialState: ApplicationFormState = {};

export default function ApplyForm({
  jobId,
  isSignedIn,
  alreadyApplied,
}: {
  jobId: number;
  isSignedIn: boolean;
  alreadyApplied: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    applyToJob.bind(null, jobId),
    initialState
  );

  if (!isSignedIn) {
    return (
      <p className="text-xs text-black/40 dark:text-white/40 mt-3">
        <Link href="/login" className="hover:underline">
          سجّل دخولك
        </Link>{" "}
        عشان تقدّم على هذي الوظيفة.
      </p>
    );
  }

  if (alreadyApplied || state.success) {
    return (
      <p className="text-sm text-green-700 dark:text-green-500 mt-3">
        قدّمت على هذي الوظيفة — صاحب العمل بيتواصل معك.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 mt-3">
      <textarea
        name="message"
        rows={2}
        maxLength={600}
        placeholder="نبذة عنك وخبرتك — اختياري"
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full"
      />
      <input
        name="contactWhatsapp"
        required
        inputMode="tel"
        placeholder="رقم واتساب للتواصل معك"
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-3 py-1.5 self-start disabled:opacity-50"
      >
        {isPending ? "جارٍ الإرسال..." : "قدّم على الوظيفة"}
      </button>
    </form>
  );
}
