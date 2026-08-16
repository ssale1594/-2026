import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { relativeTimeAr } from "@/lib/relative-time";
import AnswerForm from "./answer-form";

type Question = {
  id: number;
  title: string;
  body: string | null;
  created_at: string;
  categories: { name_ar: string } | null;
  neighborhoods: { name_ar: string } | null;
};

async function getQuestion(id: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("id, title, body, created_at, categories(name_ar), neighborhoods(name_ar)")
    .eq("id", id)
    .single<Question>();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const question = await getQuestion(Number(id));

  if (!question) {
    return { title: pageTitle("سؤال غير موجود") };
  }

  return {
    title: pageTitle(question.title),
    description: question.body?.slice(0, 160) ?? question.title,
  };
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const questionId = Number(id);

  if (!Number.isInteger(questionId)) {
    notFound();
  }

  const question = await getQuestion(questionId);

  if (!question) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: answers }, { data: { user } }, { data: sellers }] =
    await Promise.all([
      supabase
        .from("answers")
        .select("id, body, created_at, sellers(business_name, slug)")
        .eq("question_id", questionId)
        .order("created_at")
        .returns<
          {
            id: number;
            body: string;
            created_at: string;
            sellers: { business_name: string; slug: string } | null;
          }[]
        >(),
      supabase.auth.getUser(),
      supabase
        .from("sellers")
        .select("id, business_name")
        .eq("verification_status", "approved")
        .order("business_name")
        .returns<{ id: string; business_name: string }[]>(),
    ]);

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
          <Link
            href="/ask"
            className="text-sm text-black/60 dark:text-white/60 hover:underline"
          >
            كل الأسئلة
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">{question.title}</h1>
        {question.body && (
          <p className="text-black/70 dark:text-white/70 whitespace-pre-line mb-3">
            {question.body}
          </p>
        )}
        <div className="text-xs text-black/40 dark:text-white/40 flex flex-wrap gap-x-3 mb-8">
          <span>{relativeTimeAr(question.created_at)}</span>
          {question.categories && <span>{question.categories.name_ar}</span>}
          {question.neighborhoods && <span>حي {question.neighborhoods.name_ar}</span>}
        </div>

        <h2 className="font-semibold mb-3">
          {answers && answers.length > 0 ? `${answers.length} رد` : "الردود"}
        </h2>

        {!answers || answers.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60 mb-8">
            ما فيه ردود بعد — كن أول من يرد.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 mb-8">
            {answers.map((answer) => (
              <li
                key={answer.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4"
              >
                <p className="text-sm text-black/80 dark:text-white/80 whitespace-pre-line">
                  {answer.body}
                </p>
                {answer.sellers && (
                  <Link
                    href={`/seller/${answer.sellers.slug}`}
                    className="inline-block text-sm text-green-700 dark:text-green-500 hover:underline mt-2"
                  >
                    يوصي بـ{answer.sellers.business_name} ←
                  </Link>
                )}
                <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                  {relativeTimeAr(answer.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <AnswerForm
          questionId={questionId}
          isSignedIn={Boolean(user)}
          sellers={sellers ?? []}
        />
      </main>
    </div>
  );
}
