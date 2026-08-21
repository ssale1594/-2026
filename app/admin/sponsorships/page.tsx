import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import SponsorshipForm from "./sponsorship-form";
import DeactivateButton from "./deactivate-button";
import { deactivateSponsorship } from "./actions";

const TARGET_LABELS: Record<string, string> = {
  home: "الرئيسية",
  category: "قسم",
  journey: "رحلة",
};

export default async function AdminSponsorshipsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: categories }, { data: journeys }, { data: sponsorships }] =
    await Promise.all([
      supabase.from("categories").select("id, name_ar").eq("is_active", true).order("sort_order"),
      supabase.from("journeys").select("id, name_ar").eq("is_active", true).order("sort_order"),
      supabase
        .from("sponsorships")
        .select("id, sponsor_name, message, target_type, target_id, starts_at, ends_at, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="sponsorships" />

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">الرعايات</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          رعاية قسم أو رحلة احتياج لفترة محددة. تُدار يدويًا (البيع يتم وجهًا
          لوجه حاليًا).
        </p>

        <SponsorshipForm
          categories={categories ?? []}
          journeys={journeys ?? []}
        />

        <h2 className="font-semibold mb-3">الرعايات النشطة</h2>
        {!sponsorships || sponsorships.length === 0 ? (
          <p className="text-black/60 dark:text-white/60 text-sm">
            ما فيه رعايات نشطة.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sponsorships.map((sponsorship) => (
              <li
                key={sponsorship.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">{sponsorship.sponsor_name}</div>
                  <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                    {TARGET_LABELS[sponsorship.target_type]} ·{" "}
                    {new Date(sponsorship.starts_at).toLocaleDateString("ar")} —{" "}
                    {new Date(sponsorship.ends_at).toLocaleDateString("ar")}
                  </div>
                  {sponsorship.message && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {sponsorship.message}
                    </p>
                  )}
                </div>
                <DeactivateButton
                  onDeactivate={deactivateSponsorship.bind(null, sponsorship.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
