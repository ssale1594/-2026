"use client";

import { useOptimistic, useTransition, useState } from "react";
import { sendChatMessage, markThreadRead } from "./inbox-actions";

export type ChatMsg = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
  read_by_buyer: boolean;
  read_by_seller: boolean;
  system_event?: string | null;
};

export default function ChatWindow({
  threadId,
  initialMessages,
  currentUserId,
  otherPartyName,
  compact = false,
}: {
  threadId: number;
  initialMessages: ChatMsg[];
  currentUserId: string;
  otherPartyName: string;
  compact?: boolean;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initialMessages ?? []);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [marking, setMarking] = useState(false);

  function scrollBottom() {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("chat-scroll-me"));
    });
  }

  function markRead() {
    if (marking) return;
    setMarking(true);
    startTransition(async () => {
      try {
        await markThreadRead(threadId);
      } finally {
        setMarking(false);
      }
    });
  }

  function send() {
    const body = draft.trim();
    if (!body || pending) return;
    const optimistic: ChatMsg = {
      id: -1 - Math.round(Math.random() * 999999),
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
      read_by_buyer: false,
      read_by_seller: false,
    };
    setMsgs((prev) => [...prev, optimistic]);
    setDraft("");
    scrollBottom();
    startTransition(async () => {
      const res = await sendChatMessage({ threadId, body });
      if ((res as any).error) {
        // إعادة المسودة وازالة الرسالة المتفائلة
        setMsgs((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(body);
        alert(`❌ فشل الإرسال: ${(res as any).error}`);
      }
    });
  }

  return (
    <div className={["flex flex-col h-full min-h-[420px]", compact ? "" : "min-h-[60vh]"].join(" ")}>
      <div
        onMouseEnter={markRead}
        className="grid place-items-stretch flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-br from-black/[.02] to-transparent dark:from-white/[.02] rounded-2xl border border-black/[.06] dark:border-white/[.08] space-y-2"
      >
        {msgs.length === 0 && (
          <div className="grid place-items-center h-full min-h-[240px] text-sm opacity-60 text-center px-4">
            <div>
              <div className="text-4xl mb-2">💬</div>
              <div className="font-semibold opacity-80 mb-1">ابدأ محادثتك الآن مع {otherPartyName}</div>
              <div className="max-w-sm mx-auto text-xs">
                كل رسالة هنا محفوظة في المنصة كدليل — في حال حدوث خلاف في
                الصفقة يمكن الرجوع لها من قبل الإدارة.
              </div>
            </div>
          </div>
        )}
        {msgs.map((m) => {
          const isMine = m.sender_id === currentUserId;
          const isSys = !!m.system_event;
          if (isSys) {
            return (
              <div key={m.id} className="text-center text-[11px] opacity-60 my-1">
                ⋆ {m.body} ⋆
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={[
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                  isMine
                    ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm"
                    : "bg-white dark:bg-neutral-800 border border-black/[.08] dark:border-white/[.1] text-black dark:text-white rounded-bl-sm",
                ].join(" ")}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</div>
                <div
                  className={[
                    "mt-1 text-[10px] flex items-center gap-1",
                    isMine ? "text-white/70" : "text-black/40 dark:text-white/50",
                  ].join(" ")}
                >
                  <span>
                    {new Date(m.created_at).toLocaleTimeString("ar-SA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMine && (
                    <span title={m.read_by_seller || m.read_by_buyer ? "تم رؤيته" : "لم يُقرأ بعد"}>
                      {(m.read_by_seller || m.read_by_buyer) ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="mt-3 flex items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 5000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            compact
              ? "اكتب رسالتك... (Enter لإرسال)"
              : `اكتب رسالتك إلى ${otherPartyName}... (Enter للإرسال، Shift+Enter لسطر جديد)`
          }
          className="flex-1 rounded-xl border border-black/[.1] dark:border-white/[.2] px-3 py-2 bg-white dark:bg-neutral-900 text-sm resize-none focus:ring-2 ring-indigo-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className={[
            "rounded-xl px-4 py-2 text-sm font-bold shadow shrink-0 transition",
            pending || !draft.trim()
              ? "bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700",
          ].join(" ")}
        >
          {pending ? "..." : "📨 إرسال"}
        </button>
      </form>
    </div>
  );
}
