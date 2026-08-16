import Link from "next/link";
import type { Metadata } from "next";
import { pageTitle, siteName } from "@/lib/seo";
import ReferForm from "./refer-form";

export const metadata: Metadata = {
  title: pageTitle("رشّح مشروعًا"),
  description:
    "تعرف على محل أو أسرة منتجة بالزلفي مو مسجلين بالمنصة؟ رشّحهم وبنتواصل معهم.",
};

export default function ReferABusinessPage() {
  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href="/" className="text-lg font-bold">
            {siteName}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">رشّح مشروعًا</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          تعرف محل أو أسرة منتجة بالزلفي وما هم مسجلين عندنا؟ رشّحهم وبنتواصل
          معهم لدعوتهم ينضمون.
        </p>
        <ReferForm />
      </main>
    </div>
  );
}
