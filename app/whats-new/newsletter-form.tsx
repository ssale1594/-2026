"use client";

import { useActionState } from "react";
import { subscribeToNewsletter, type NewsletterFormState } from "./newsletter-actions";

const initialState: NewsletterFormState = {};

export default function NewsletterForm() {
  const [state, formAction, pending] = useActionState(
    subscribeToNewsletter,
    initialState
  );

  if (state.ok) {
    return (
      <p className="rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 px-4 py-3 text-sm">
        {state.ok}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap gap-2 items-start">
      <div className="flex-1 min-w-[200px]">
        <input
          type="email"
          name="email"
          required
          placeholder="بريدك الإلكتروني"
          dir="ltr"
          className="w-full rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-2 bg-transparent text-sm"
        />
        {state.error && (
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50 shrink-0"
      >
        {pending ? "جاري..." : "اشترك بالنشرة"}
      </button>
    </form>
  );
}
