import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import DashboardHeader from "../../../dashboard-header";
import EditListingForm from "./edit-listing-form";
import ImageManager from "./image-manager";

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
    .select(
      "id, title, description, category_id, neighborhood_id, price, price_negotiable"
    )
    .eq("id", id)
    .eq("seller_id", seller.id)
    .single();

  if (!listing) {
    notFound();
  }

  const [{ data: categories }, neighborhoods] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name_ar")
      .eq("is_active", true)
      .order("sort_order"),
    getNeighborhoods(),
  ]);

  const { data: images } = await supabase
    .from("listing_images")
    .select("id, storage_path")
    .eq("listing_id", listing.id)
    .order("sort_order");

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">تعديل الإعلان</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          أي تعديل يرجّع الإعلان للمراجعة قبل ظهوره من جديد.
        </p>
        <div className="mb-8">
          <ImageManager
            sellerId={seller.id}
            listingId={listing.id}
            images={images ?? []}
          />
        </div>
        <EditListingForm
          listing={listing}
          categories={categories ?? []}
          neighborhoods={neighborhoods}
        />
      </main>
    </div>
  );
}
