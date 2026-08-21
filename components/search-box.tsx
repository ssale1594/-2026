"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  defaultValue?: string;
  placeholder?: string;
  showVoice?: boolean;
  size?: "sm" | "md" | "lg";
};

export default function SearchBox({
  defaultValue = "",
  placeholder = "ابحث عن منتج، خدمة، أو محل...",
  showVoice = true,
  size = "md",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const sizes = {
    sm: { input: "px-3 py-1.5 text-sm", button: "px-3 py-1.5 text-sm" },
    md: { input: "px-4 py-2.5 text-sm", button: "px-4 py-2.5 text-sm" },
    lg: { input: "px-5 py-3 text-base", button: "px-5 py-3 text-base" },
  }[size];

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (SR) {
      setVoiceSupported(true);
      const rec = new SR();
      rec.lang = "ar-SA";
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) setQuery(transcript.trim());
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  function submit(ev?: React.FormEvent) {
    ev?.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function toggleVoice() {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      if (isListening) {
        rec.stop();
        setIsListening(false);
      } else {
        rec.start();
        setIsListening(true);
      }
    } catch {
      setIsListening(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-xl border border-black/[.12] dark:border-white/[.2] bg-transparent ${sizes.input} pr-12 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition`}
          />
          {showVoice && voiceSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              title={isListening ? "إيقاف التسجيل" : "البحث الصوتي"}
              aria-label="بحث صوتي"
              className={`absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-black/40 dark:text-white/40 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          className={`rounded-xl bg-foreground text-background font-semibold ${sizes.button} inline-flex items-center gap-2 hover:opacity-90 transition`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          بحث
        </button>
      </div>
      {isListening && (
        <div className="mt-2 text-xs text-red-600 font-medium inline-flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          يستمع... تحدث الآن بالعربية
        </div>
      )}
    </form>
  );
}
