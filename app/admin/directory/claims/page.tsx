import Link from "next/link";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../../admin-header";
import ClaimActions from "../claim-actions";
import { decideDirectoryClaim } from "../actions";

type Claim = {
  id: number;
  claimant_whatsapp: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  directory_entries: { business_name: string } | null;
};

export default async function DirectoryClaimsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: claims } = await supabase
    .from("directory_claims")
    .select(
      "id, claimant_whatsapp, note, status, created_at, directory_entries(business_name)"
    )
    .eq("status", "pending")
    .order("created_at")
    .returns<Claim[]>();

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="directory" />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link
          href="/admin/directory"
          className="text-sm text-black/60 dark:text-white/60 hover:underline"
        >
          ← الدليل العام
        </Link>
        <h1 className="text-xl font-semibold mt-2 mb-6">طلبات تبنّي محلات</h1>

        {!claims || claims.length === 0 ? (
          <p className="text-black/60 dark:text-white/60">
            ما فيه طلبات بانتظار المراجعة.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {claims.map((claim) => (
              <li
                key={claim.id}
                className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="font-medium">
                    {claim.directory_entries?.business_name}
                  </div>
                  <a
                    href={`https://wa.me/${claim.claimant_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                      "مرحبًا، معك فريق سوق الزلفي بخصوص طلبك تبنّي محلك بالدليل العام."
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400 hover:underline mt-1"
                  >
                    📱 {claim.claimant_whatsapp} — تواصل واتساب
                  </a>
                  {claim.note && (
                    <p className="text-sm text-black/60 dark:text-white/60 mt-2">
                      {claim.note}
                    </p>
                  )}
                </div>
                <ClaimActions
                  onApprove={decideDirectoryClaim.bind(null, claim.id, "approved", undefined)}
                  onReject={decideDirectoryClaim.bind(null, claim.id, "rejected", undefined)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
