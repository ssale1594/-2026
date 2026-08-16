import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import MarkAllRead from "./mark-all-read";

export const metadata: Metadata = {
  title: pageTitle("الإشعارات"),
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<
      {
        id: number;
        type: string;
        title: string;
        body: string | null;
        link: string | null;
        is_read: boolean;
        created_at: string;
      }[]
    >();

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <MarkAllRead disabled={unreadCount === 0} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">
          الإشعارات
          {unreadCount > 0 && (
            <span className="text-sm font-normal text-black/50 dark:text-white/50">
              {" "}
              ({unreadCount} جديد)
            </span>
          )}
        </h1>

        {!notifications || notifications.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه إشعارات.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notifications.map((notification) => {
              const content = (
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    notification.is_read
                      ? "border-black/[.08] dark:border-white/[.145]"
                      : "border-black/[.2] dark:border-white/[.3] bg-black/[.02] dark:bg-white/[.04]"
                  }`}
                >
                  <div className="font-medium text-sm">{notification.title}</div>
                  {notification.body && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-1">
                      {notification.body}
                    </p>
                  )}
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                    {relativeTimeAr(notification.created_at)}
                  </div>
                </div>
              );

              return (
                <li key={notification.id}>
                  {notification.link ? (
                    <Link href={notification.link} className="block">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
