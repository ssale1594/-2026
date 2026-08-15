import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "../../dashboard-header";
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
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

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
