import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "../dashboard-header";
import SetupForm from "./setup-form";

export default async function SetupPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existingSeller } = await supabase
    .from("sellers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingSeller) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader />

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">بيانات نشاطك</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          نراجع كل نشاط جديد قبل ظهوره بالموقع.
        </p>
        <SetupForm />
      </main>
    </div>
  );
}
