"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({
  referralCode = "",
}: {
  referralCode?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");

    // Carry the referral code through the magic-link round trip: the user
    // leaves for their email client and comes back on a fresh request, so it
    // has to ride along in the callback URL or the attribution is lost.
    const callback = new URL(`${window.location.origin}/auth/callback`);
    if (referralCode) {
      callback.searchParams.set("ref", referralCode);
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString() },
    });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <p className="text-sm">
        أرسلنا رابط الدخول إلى <span className="font-medium">{email}</span>. افتح
        بريدك واضغط الرابط لإكمال الدخول.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="بريدك الإلكتروني"
        className="rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {status === "sending" ? "جارٍ الإرسال..." : "أرسل رابط الدخول"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </form>
  );
}
