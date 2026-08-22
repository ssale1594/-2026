import Link from "next/link";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import DirectoryForm from "./directory-form";
import DirectoryEntryActions from "./entry-actions";
import { setDirectoryEntryStatus } from "./actions";

type Entry = {
  id: number;
  business_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  address_note: string | null;
  source_note: string;
  status: "published" | "hidden";
  claimed_by_seller_id: string | null;
  categories: { name_ar: string } | null;
  neighborhoods: { name_ar: string } | null;
};

export default async function AdminDirectoryPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [entriesQ, categoriesQ, hoodsQ, pendingClaimsQ] = await Promise.all([
    supabase
      .from("directory_entries")
      .select(
        "id, business_name, phone, whatsapp_number, address_note, source_note, status, claimed_by_seller_id, categories(name_ar), neighborhoods(name_ar)"
      )
      .order("created_at", { ascending: false })
      .returns<Entry[]>(),
    supabase.from("categories").select("id, name_ar").order("sort_order"),
    supabase.from("neighborhoods").select("id, name_ar").order("name_ar"),
    supabase
      .from("directory_claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const entries = entriesQ.data ?? [];
  const pendingClaims = pendingClaimsQ.count ?? 0;

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="directory" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-semibold">📖 الدليل العام للزلفي</h1>
          <Link
            href="/admin/directory/claims"
            className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            طلبات التبنّي {pendingClaims > 0 ? `(${pendingClaims})` : ""}
          </Link>
        </div>

        <p className="text-sm text-black/60 dark:text-white/60 mb-6 leading-relaxed">
          محلات وأماكن معروفة بالزلفي حتى لو أصحابها ما سجّلوا بأنفسهم بعد —
          يعطي الموقع محتوى مفيد من اليوم الأول. أضف فقط من مصادر عامة (خرائط
          قوقل، معرفة شخصية بالمكان)، ما تحط أرقامًا خاصة بدون إذن.
        </p>

        <div className="mb-8">
          <DirectoryForm
            categories={(categoriesQ.data ?? []) as { id: number; name_ar: string }[]}
            neighborhoods={(hoodsQ.data ?? []) as { id: number; name_ar: string }[]}
          />
        </div>

        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">
          الإدخالات ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">ما فيه إدخالات بعد.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">
                    {entry.business_name}
                    {entry.claimed_by_seller_id && (
                      <span className="mr-2 text-xs rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                        تم التبنّي
                      </span>
                    )}
                    {entry.status === "hidden" && (
                      <span className="mr-2 text-xs rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 px-2 py-0.5">
                        مخفي
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-black/50 dark:text-white/50 mt-1">
                    {entry.categories?.name_ar} · {entry.neighborhoods?.name_ar} ·{" "}
                    {entry.phone || entry.whatsapp_number || "بلا رقم"}
                  </p>
                  <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                    المصدر: {entry.source_note}
                  </p>
                </div>
                <DirectoryEntryActions
                  status={entry.status}
                  onToggle={setDirectoryEntryStatus.bind(
                    null,
                    entry.id,
                    entry.status === "published" ? "hidden" : "published"
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
