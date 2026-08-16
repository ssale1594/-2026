import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import NeedForm from "./need-form";

export const metadata: Metadata = {
  title: pageTitle("انشر طلبك"),
  description:
    "محتاج خدمة أو منتج بالزلفي وما تدري وين تلقاه؟ انشر طلبك والبائعون المناسبون يتواصلون معك.",
};

export default async function NewNeedPage() {
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
            href="/needs"
            className="text-sm text-black/60 dark:text-white/60 hover:underline"
          >
            كل الطلبات
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">انشر طلبك</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          بدل ما تدور بنفسك، اكتب وش تحتاج والبائعون بالزلفي يتواصلون معك.
        </p>
        <NeedForm categories={categories ?? []} neighborhoods={neighborhoods} />
      </main>
    </div>
  );
}
