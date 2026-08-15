import { requireSeller } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "../dashboard-header";
import { startCheckout } from "./actions";

export default async function SubscriptionPage() {
  const seller = await requireSeller();
  const supabase = await createClient();

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("seller_id", seller.id)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .maybeSingle();

  const { data: plan } = await supabase
    .from("plans")
    .select("name, monthly_price")
    .eq("is_active", true)
    .single();

  return (
    <div className="min-h-screen font-sans">
      <DashboardHeader backHref="/dashboard" backLabel="رجوع للوحة" />

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold mb-6">الاشتراك</h1>

        {activeSubscription ? (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">
            اشتراكك فعّال لين{" "}
            {new Date(activeSubscription.current_period_end).toLocaleDateString(
              "ar-SA"
            )}
          </div>
        ) : plan ? (
          <div className="rounded-lg border border-black/[.08] dark:border-white/[.145] p-5">
            <div className="font-medium mb-1">{plan.name}</div>
            <div className="text-2xl font-semibold mb-4">
              {plan.monthly_price} ر.س{" "}
              <span className="text-sm font-normal text-black/60 dark:text-white/60">
                / شهريًا
              </span>
            </div>
            <form action={startCheckout}>
              <button
                type="submit"
                className="w-full rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2"
              >
                اشترك الآن
              </button>
            </form>
          </div>
        ) : (
          <p className="text-black/60 dark:text-white/60">
            ما فيه خطة اشتراك متاحة حاليًا.
          </p>
        )}
      </main>
    </div>
  );
}
