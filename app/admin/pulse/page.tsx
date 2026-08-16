import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import AdminHeader from "../admin-header";

type TopSearch = { query: string; searches: number; avg_results: number };
type DemandGap = { query: string; searches: number };
type CategoryDemand = {
  category_name: string;
  published_listings: number;
  open_needs: number;
};

export default async function AdminPulsePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [topSearches, demandGaps, categoryDemand, counts] = await Promise.all([
    supabase.rpc("pulse_top_searches", { p_days: 30, p_limit: 20 }),
    supabase.rpc("pulse_demand_gaps", { p_days: 90, p_limit: 20 }),
    supabase.rpc("pulse_category_demand"),
    supabase.from("search_log").select("id", { count: "exact", head: true }),
  ]);

  const top = (topSearches.data as TopSearch[]) ?? [];
  const gaps = (demandGaps.data as DemandGap[]) ?? [];
  const byCategory = (categoryDemand.data as CategoryDemand[]) ?? [];

  return (
    <div className="min-h-screen font-sans">
      <AdminHeader active="pulse" />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-2">نبض الزلفي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-8">
          وش يدور عنه الناس، ووش ما يلقونه. البيانات مجمّعة بالكامل — ما نخزن
          أي معلومة تربط بحث بشخص معين. (إجمالي عمليات البحث المسجلة:{" "}
          {counts.count ?? 0})
        </p>

        <section className="mb-10">
          <h2 className="font-semibold mb-1">ماذا ينقص الزلفي؟</h2>
          <p className="text-xs text-black/50 dark:text-white/50 mb-3">
            بحث عنها الناس وما لقوا ولا نتيجة — أقوى مؤشر على فرصة تجارية
            ناقصة بالبلد (آخر 90 يوم).
          </p>
          {gaps.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40">
              ما فيه عمليات بحث بدون نتائج بعد.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {gaps.map((gap) => (
                <li
                  key={gap.query}
                  className="flex items-center justify-between rounded-lg border border-black/[.08] dark:border-white/[.145] px-3 py-2 text-sm"
                >
                  <span>{gap.query}</span>
                  <span className="text-black/50 dark:text-white/50">
                    {gap.searches} بحث
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-10">
          <h2 className="font-semibold mb-1">أكثر ما يُبحث عنه</h2>
          <p className="text-xs text-black/50 dark:text-white/50 mb-3">
            آخر 30 يوم.
          </p>
          {top.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40">
              ما فيه عمليات بحث مسجلة بعد.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {top.map((row) => (
                <li
                  key={row.query}
                  className="flex items-center justify-between rounded-lg border border-black/[.08] dark:border-white/[.145] px-3 py-2 text-sm"
                >
                  <span>{row.query}</span>
                  <span className="text-black/50 dark:text-white/50">
                    {row.searches} بحث · {row.avg_results} نتيجة بالمتوسط
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-semibold mb-1">العرض مقابل الطلب حسب القسم</h2>
          <p className="text-xs text-black/50 dark:text-white/50 mb-3">
            عدد الإعلانات المنشورة مقابل عدد الطلبات المفتوحة بكل قسم.
          </p>
          <ul className="flex flex-col gap-1">
            {byCategory.map((row) => (
              <li
                key={row.category_name}
                className="flex items-center justify-between rounded-lg border border-black/[.08] dark:border-white/[.145] px-3 py-2 text-sm"
              >
                <span>{row.category_name}</span>
                <span className="text-black/50 dark:text-white/50">
                  {row.published_listings} إعلان · {row.open_needs} طلب
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
