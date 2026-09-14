import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "../../dashboard-header";
import MatchCandidateCard from "./match-candidate-card";

type MatchRow = {
  id: number;
  business_name: string;
  category_name: string | null;
  neighborhood_name: string | null;
  address_note: string | null;
};

export default async function SetupMatchPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  // نعيد نفس المطابقة اللي شغّلتها actions.ts فور التسجيل بدل تمرير النتيجة
  // عبر الرابط — أبسط، ويبقى صحيحًا حتى لو رجع المستخدم لهذي الصفحة لاحقًا.
  const { data } = await supabase.rpc("match_unclaimed_directory", {
    p_business_name: seller.business_name,
  });

  const matches = (data ?? []) as MatchRow[];

  if (matches.length === 0) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader />

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">📍 لقينا محلات بنفس الاسم</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          دليل الزلفي العام فيه سجلات بنفس اسم نشاطك «{seller.business_name}» —
          لو أحدها محلك، اطلب التحكّم فيه وبنراجعه ونربطه بحسابك.
        </p>

        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <MatchCandidateCard
              key={m.id}
              id={m.id}
              businessName={m.business_name}
              categoryName={m.category_name}
              neighborhoodName={m.neighborhood_name}
              addressNote={m.address_note}
            />
          ))}
        </div>

        <Link
          href="/dashboard"
          className="inline-block mt-6 text-sm text-black/60 dark:text-white/60 hover:underline"
        >
          ولا وحد منها — تخطي إلى لوحة التحكم ←
        </Link>
      </main>
    </div>
  );
}
