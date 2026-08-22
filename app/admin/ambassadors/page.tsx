import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";
import { setAmbassadorStatus } from "./actions";
import AmbassadorActions from "./ambassador-actions";

type Row = {
  id: number;
  note: string | null;
  applied_at: string;
  neighborhoods: { name_ar: string } | null;
  profiles: { full_name: string | null } | null;
};

export default async function AdminAmbassadorsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("neighborhood_ambassadors")
    .select("id, note, applied_at, neighborhoods(name_ar), profiles(full_name)")
    .eq("status", "pending")
    .order("applied_at")
    .returns<Row[]>();

  const { data: approved } = await supabase
    .from("neighborhood_ambassadors")
    .select("id, note, applied_at, neighborhoods(name_ar), profiles(full_name)")
    .eq("status", "approved")
    .order("applied_at", { ascending: false })
    .returns<Row[]>();

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="ambassadors" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">🙌 طلبات سفراء الأحياء</h1>

        {!pending || pending.length === 0 ? (
          <p className="text-black/60 dark:text-white/60 mb-8">
            ما فيه طلبات بانتظار المراجعة.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 mb-10">
            {pending.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">
                    {row.profiles?.full_name || "مستخدم بلا اسم"} —{" "}
                    {row.neighborhoods?.name_ar}
                  </div>
                  {row.note && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {row.note}
                    </p>
                  )}
                </div>
                <AmbassadorActions
                  onApprove={setAmbassadorStatus.bind(null, row.id, "approved")}
                  onRevoke={setAmbassadorStatus.bind(null, row.id, "revoked")}
                />
              </li>
            ))}
          </ul>
        )}

        <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">
          سفراء معتمدون ({approved?.length ?? 0})
        </h2>
        <ul className="flex flex-col gap-2">
          {(approved ?? []).map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-3 flex items-center justify-between gap-4 text-sm"
            >
              <span>
                {row.profiles?.full_name || "مستخدم بلا اسم"} —{" "}
                {row.neighborhoods?.name_ar}
              </span>
              <AmbassadorActions
                onApprove={setAmbassadorStatus.bind(null, row.id, "approved")}
                onRevoke={setAmbassadorStatus.bind(null, row.id, "revoked")}
              />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
