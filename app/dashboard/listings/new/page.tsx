import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import NewListingForm from "./new-listing-form";

export default async function NewListingPage() {
  await requireSeller();
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_ar")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            سوق الزلفي
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-black/60 dark:text-white/60"
          >
            رجوع للوحة
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">إضافة إعلان</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          الإعلان يروح للمراجعة قبل ما يظهر للزوار.
        </p>
        <NewListingForm categories={categories ?? []} />
      </main>
    </div>
  );
}
