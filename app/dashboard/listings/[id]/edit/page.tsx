import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { siteName } from "@/lib/seo";
import EditListingForm from "./edit-listing-form";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seller = await requireSeller();
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, description, category_id, price, price_negotiable")
    .eq("id", id)
    .eq("seller_id", seller.id)
    .single();

  if (!listing) {
    notFound();
  }

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
            {siteName}
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
        <h1 className="text-xl font-semibold mb-2">تعديل الإعلان</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          أي تعديل يرجّع الإعلان للمراجعة قبل ظهوره من جديد.
        </p>
        <EditListingForm listing={listing} categories={categories ?? []} />
      </main>
    </div>
  );
}
