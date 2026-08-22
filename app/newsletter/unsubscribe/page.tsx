import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";

export const metadata = { title: pageTitle("إلغاء الاشتراك") };

// A plain page rather than a route handler: unsubscribe links get opened
// directly in a browser tab from an email client, and this needs to show the
// person something either way, not return raw JSON.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const supabase = await createClient();

  const ok = token
    ? (await supabase.rpc("newsletter_unsubscribe", { p_token: token })).data
    : false;

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="text-lg font-semibold mb-2">
          {ok ? "تم إلغاء اشتراكك ✅" : "الرابط غير صالح"}
        </p>
        <p className="text-sm text-black/60 dark:text-white/60">
          {ok
            ? "ما راح تستلم النشرة الأسبوعية بعد الآن."
            : "يبدو أن هذا الرابط استُخدم من قبل أو غير صحيح."}
        </p>
        <Link
          href="/"
          className="inline-block mt-6 text-sm underline hover:no-underline"
        >
          الرجوع للرئيسية
        </Link>
      </main>
    </div>
  );
}
