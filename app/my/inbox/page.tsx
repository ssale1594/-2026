import Link from "next/link";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import ChatWindow, { type ChatMsg } from "./chat-window";

export const metadata = {
  title: `الرسائل - ${siteName}`,
  description: "عرض وملاحظة المحادثات والرسائل مع البائعين داخل المنصة.",
};

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
  searchParams,
}: {
  params?: Promise<{ id?: string }>;
  searchParams?: Promise<{ thread?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const sp = await searchParams;
  const pp = await params;
  const openThreadId =
    sp?.thread ? Number(sp.thread) : pp?.id ? Number(pp.id) : null;

  // تحميل جميع الـ threads كـ buyer وكـ seller في نفس الوقت
  const [{ data: asBuyer }, { data: asSeller }] = await Promise.all([
    supabase
      .from("chat_threads")
      .select(
        "id, subject, listing_id, deal_id, buyer_id, seller_id, created_at, " +
          "last_message_at, last_message_body, last_message_sender_id, unread_buyer_count, " +
          "buyers:profiles!chat_threads_buyer_id_fkey(full_name), " +
          "sellers:sellers!chat_threads_seller_id_fkey(business_name, slug), " +
          "listings(title, slug), deals(id, status, title)"
      )
      .eq("buyer_id", user.id)
      .eq("archived_by_buyer", false)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("chat_threads")
      .select(
        "id, subject, listing_id, deal_id, buyer_id, seller_id, created_at, " +
          "last_message_at, last_message_body, last_message_sender_id, unread_seller_count, " +
          "buyers:profiles!chat_threads_buyer_id_fkey(full_name), " +
          "sellers:sellers!chat_threads_seller_id_fkey(business_name, slug), " +
          "listings(title, slug), deals(id, status, title)"
      )
      .eq("seller_id", user.id)
      .eq("archived_by_seller", false)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  type Thread = any;
  const merged: Thread[] = [];
  for (const t of (asBuyer as Thread[]) ?? []) {
    merged.push({
      ...t,
      _role: "buyer" as const,
      _other_name:
        t.sellers?.business_name || "بائع",
      _other_slug: t.sellers?.slug,
      _unread: t.unread_buyer_count ?? 0,
    });
  }
  for (const t of (asSeller as Thread[]) ?? []) {
    merged.push({
      ...t,
      _role: "seller" as const,
      _other_name:
        t.buyers?.full_name || "عميل",
      _other_slug: undefined,
      _unread: t.unread_seller_count ?? 0,
    });
  }

  merged.sort((a: Thread, b: Thread) => {
    const ta = a.last_message_at ?? a.created_at;
    const tb = b.last_message_at ?? b.created_at;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  // تحميل رسائل الـ thread المفتوح إن وجد
  let activeThread: Thread | null = null;
  let messages: ChatMsg[] = [];
  if (openThreadId) {
    activeThread = merged.find((t) => t.id === openThreadId) ?? null;
    if (activeThread) {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, body, created_at, read_by_buyer, read_by_seller, system_event")
        .eq("thread_id", openThreadId)
        .order("created_at", { ascending: true })
        .limit(300);
      messages = (data as ChatMsg[]) ?? [];
    }
  }

  const totalUnread = merged.reduce((s, t) => s + Number(t._unread || 0), 0);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-black dark:text-white">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-7xl px-4 py-5 flex items-center justify-between gap-3 flex-wrap">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <nav className="text-sm text-black/60 dark:text-white/60 flex items-center gap-3 flex-wrap">
            <Link href="/" className="hover:underline">الرئيسية</Link>
            <Link href="/my/deals" className="hover:underline">صفقاتي</Link>
            <Link href="/my/offers" className="hover:underline">💰 عروضي المالية</Link>
            <Link href="/my/saved-searches" className="hover:underline">بحوثاتي المحفوظة</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <nav className="text-xs text-black/50 dark:text-white/50 mb-3">
            <Link href="/" className="hover:underline">الرئيسية</Link> /{" "}
            <b>الرسائل والدردشات</b>
          </nav>
          <h1 className="text-3xl font-extrabold inline-flex items-center gap-3">
            📥 صندوق الرسائل
            {totalUnread > 0 && (
              <span className="rounded-full bg-rose-500 text-white text-sm font-bold px-3 py-0.5 grid place-items-center">
                {totalUnread} جديدة
              </span>
            )}
          </h1>
          <p className="text-sm opacity-60 mt-2 max-w-2xl">
            كل رسائل محادثاتك مع الباعة والعملاء في مكان واحد. الرسائل محفوظة
            وتُستخدم كدليل في حالة رفع خصومة على صفقة.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Threads list */}
          <aside className="rounded-2xl border border-black/[.08] dark:border-white/[.145] overflow-hidden flex flex-col max-h-[70vh]">
            <div className="p-3 border-b border-black/[.06] dark:border-white/[.08] text-sm font-bold bg-black/[.02] dark:bg-white/[.04]">
              المحادثات ({merged.length})
            </div>
            <div className="overflow-y-auto flex-1">
              {merged.length === 0 ? (
                <div className="p-6 text-center text-sm opacity-60">
                  لا توجد محادثات بعد. ابدأ محادثة من صفحة أي إعلان أو صفحة
                  البائع بالضغط على زر «تواصل داخل المنصة».
                </div>
              ) : (
                <ul>
                  {merged.map((t) => {
                    const active = openThreadId === t.id;
                    const prefix = t._role === "buyer" ? "🛒" : "🏪";
                    return (
                      <li key={`${t._role}-${t.id}`}>
                        <Link
                          href={`/my/inbox?thread=${t.id}`}
                          className={[
                            "block p-3 border-b border-black/[.05] dark:border-white/[.06] flex items-start justify-between gap-3 transition",
                            active
                              ? "bg-indigo-500/10 border-l-4 border-l-indigo-500"
                              : "hover:bg-black/[.03] dark:hover:bg-white/[.04]",
                          ].join(" ")}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="opacity-70 text-xs">{prefix}</span>
                              <span className="font-bold text-sm truncate">{t._other_name}</span>
                              {t._unread > 0 && (
                                <span className="rounded-full bg-indigo-600 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] grid place-items-center">
                                  {t._unread}
                                </span>
                              )}
                            </div>
                            <div className="text-xs opacity-70 line-clamp-1">
                              {t.subject || t.listings?.title || t.deals?.title || "محادثة عامة"}
                            </div>
                            <div className="text-[11px] opacity-50 line-clamp-1 mt-1">
                              {t.last_message_body || "لا توجد رسائل بعد."}
                            </div>
                          </div>
                          <div className="shrink-0 text-[10px] opacity-55 text-left">
                            {relativeTimeAr(t.last_message_at ?? t.created_at)}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Chat */}
          <section className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4">
            {!activeThread ? (
              <div className="min-h-[50vh] grid place-items-center text-center px-6 py-10">
                <div>
                  <div className="text-6xl mb-3 opacity-30">💬</div>
                  <div className="text-xl font-bold mb-1">اختر محادثة للبدء</div>
                  <div className="text-sm opacity-60 max-w-md mx-auto">
                    اختر أي محادثة من القائمة على اليمين لعرض الرسائل والرد عليها
                    مباشرة. أو ابدأ محادثة جديدة من صفحة الإعلان أو البائع.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b border-black/[.06] dark:border-white/[.08]">
                  <div>
                    <div className="text-lg font-bold inline-flex items-center gap-2">
                      محادثة مع {activeThread._other_name}
                      {activeThread._other_slug && (
                        <Link
                          href={
                            activeThread._role === "buyer"
                              ? `/seller/${activeThread._other_slug}`
                              : `/seller/${activeThread._other_slug}`
                          }
                          className="text-xs opacity-60 hover:underline font-normal"
                        >
                          عرض ملفه
                        </Link>
                      )}
                    </div>
                    {activeThread.subject && (
                      <div className="text-sm opacity-70 mt-0.5">{activeThread.subject}</div>
                    )}
                    {activeThread.listings && (
                      <Link
                        href={`/listing/${activeThread.listings.slug}`}
                        className="text-xs text-sky-700 dark:text-sky-300 hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        🧾 حول الإعلان: {activeThread.listings.title} ←
                      </Link>
                    )}
                    {activeThread.deals && (
                      <Link
                        href={
                          activeThread._role === "buyer" ? "/my/deals" : "/dashboard/deals"
                        }
                        className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1 mt-1 ml-2"
                      >
                        🤝 مرتبطة بصفقة #{activeThread.deals.id} ({activeThread.deals.status}) ←
                      </Link>
                    )}
                  </div>
                </div>
                <ChatWindow
                  threadId={activeThread.id}
                  initialMessages={messages}
                  currentUserId={user.id}
                  otherPartyName={activeThread._other_name}
                />
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// Silence unused for re-export
const _r = requireUser;
