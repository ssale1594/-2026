import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";

export const metadata: Metadata = {
  title: pageTitle("طلبات أهل الزلفي"),
  description:
    "شوف وش يحتاج أهل الزلفي الآن — طلبات حقيقية من السكان تنتظر من يقدمها.",
};

const LIMIT = 50;

export default async function NeedsPage() {
  const supabase = await createClient();

  // RLS already limits this to open, unexpired requests.
  const { data: requests } = await supabase
    .from("need_requests")
    .select(
      "id, title, description, created_at, categories(name_ar), neighborhoods(name_ar, slug)"
    )
    .order("created_at", { ascending: false })
    .limit(LIMIT)
    .returns<
      {
        id: number;
        title: string;
        description: string | null;
        created_at: string;
        categories: { name_ar: string } | null;
        neighborhoods: { name_ar: string; slug: string } | null;
      }[]
    >();

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <Link
            href="/needs/new"
            className="rounded-lg bg-foreground text-background text-sm font-medium px-3 py-1.5"
          >
            انشر طلبك
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">طلبات أهل الزلفي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          طلبات حقيقية من سكان الزلفي. لو تقدر تقدم أي طلب منها، سجّل كبائع
          ورد عليه من لوحتك.
        </p>

        {!requests || requests.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه طلبات مفتوحة حاليًا —{" "}
            <Link href="/needs/new" className="underline">
              كن أول من ينشر طلب
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <div className="font-medium mb-1">{request.title}</div>
                {request.description && (
                  <p className="text-sm text-black/70 dark:text-white/70 whitespace-pre-line mb-2">
                    {request.description}
                  </p>
                )}
                <div className="text-xs text-black/40 dark:text-white/40 flex flex-wrap gap-x-3 gap-y-1">
                  <span>{relativeTimeAr(request.created_at)}</span>
                  {request.categories && <span>{request.categories.name_ar}</span>}
                  {request.neighborhoods && (
                    <Link
                      href={`/neighborhood/${request.neighborhoods.slug}`}
                      className="hover:underline"
                    >
                      حي {request.neighborhoods.name_ar}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
