import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";

export const metadata: Metadata = {
  title: pageTitle("اسأل أهل الزلفي"),
  description:
    "اسأل أهل الزلفي عن أي خدمة أو محل، وخذ توصيات من ناس جربوها فعلًا.",
};

export default async function AskIndexPage() {
  const supabase = await createClient();

  const [{ data: questions }, { data: { user } }] = await Promise.all([
    supabase
      .from("questions")
      .select("id, title, answer_count, created_at, categories(name_ar), neighborhoods(name_ar)")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<
        {
          id: number;
          title: string;
          answer_count: number;
          created_at: string;
          categories: { name_ar: string } | null;
          neighborhoods: { name_ar: string } | null;
        }[]
      >(),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <Link
            href={user ? "/ask/new" : "/login"}
            className="rounded-lg bg-foreground text-background text-sm font-medium px-3 py-1.5"
          >
            اسأل
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">اسأل أهل الزلفي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          &quot;مين يعرف كهربائي زين؟&quot; — اسأل وخذ توصيات من جيرانك، وكل
          توصية تربطك بصفحة البائع مباشرة.
        </p>

        {!questions || questions.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه أسئلة بعد —{" "}
            <Link href={user ? "/ask/new" : "/login"} className="underline">
              كن أول من يسأل
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {questions.map((question) => (
              <li key={question.id}>
                <Link
                  href={`/ask/${question.id}`}
                  className="block rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                >
                  <div className="font-medium mb-1">{question.title}</div>
                  <div className="text-xs text-black/40 dark:text-white/40 flex flex-wrap gap-x-3">
                    <span>
                      {question.answer_count > 0
                        ? `${question.answer_count} رد`
                        : "ما فيه ردود بعد"}
                    </span>
                    <span>{relativeTimeAr(question.created_at)}</span>
                    {question.categories && <span>{question.categories.name_ar}</span>}
                    {question.neighborhoods && (
                      <span>حي {question.neighborhoods.name_ar}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
