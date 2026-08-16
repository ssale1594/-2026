import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import QuestionForm from "./question-form";

export const metadata: Metadata = {
  title: pageTitle("اسأل سؤال"),
  robots: { index: false, follow: true },
};

export default async function NewQuestionPage() {
  await requireUser();
  const supabase = await createClient();

  const [{ data: categories }, neighborhoods] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name_ar")
      .eq("is_active", true)
      .order("sort_order"),
    getNeighborhoods(),
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

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">اسأل أهل الزلفي</h1>
        <QuestionForm
          categories={categories ?? []}
          neighborhoods={neighborhoods}
        />
      </main>
    </div>
  );
}
