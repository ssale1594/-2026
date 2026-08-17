import Link from "next/link";
import { Metadata } from "next";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import PollVoteClient from "./poll-vote-client";
import { siteName, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "الاستفتاء الأسبوعي — أفضل بائع في الزلفي",
  description: "صوّت لاختيار أفضل بائع في الزلفي هذا الأسبوع وشاهد نتائج استفتاءات الأسبوع السابقة.",
};

export default async function PollsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // active poll (current)
  const activeQ = await supabase.rpc("get_active_poll");
  const active = (activeQ.data as any[])?.[0] ?? null;

  let options: any[] = [];
  let results: any[] = [];
  let optionsWithProfiles: any[] = [];
  let resultsWithProfiles: any[] = [];

  if (active) {
    const optsQ = await supabase
      .from("poll_options")
      .select("id, seller_id, sort_order, profiles(id, business_name, full_name, slug, trust_level, profile_image, thumbnail_storage_path, category_name, verified_company_id, free_listing_limit, active_listings_count, verification_status)")
      .eq("poll_id", active.id)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    options = (optsQ.data ?? []).map((o: any) => ({
      id: o.id,
      seller_id: o.seller_id,
      sort_order: o.sort_order,
      seller: o.profiles,
    }));

    // results even for active poll: show percentages if closed OR always preview
    const resQ = await supabase.rpc("poll_results", { p_poll_id: active.id });
    results = (resQ.data as any[]) ?? [];

    const sellerIds = Array.from(
      new Set([...options.map((o: any) => o.seller_id), ...results.map((r: any) => r.seller_id)])
    );
    const profsQ = await supabase
      .from("profiles")
      .select("id, business_name, full_name, slug, trust_level, profile_image, thumbnail_storage_path, category_name, verified_company_id, verification_status, vouch_count, average_rating")
      .in("id", sellerIds as any);
    const profMap = new Map((profsQ.data ?? []).map((p: any) => [p.id, p]));

    optionsWithProfiles = options.map((o: any) => ({
      id: o.id,
      seller: profMap.get(o.seller_id),
    }));
    resultsWithProfiles = results.map((r: any) => ({
      ...r,
      seller: profMap.get(r.seller_id),
    }));
  }

  // past closed polls (history)
  const histQ = await supabase
    .from("polls")
    .select("id, title, description, week_start_date, week_end_date, status, winner_seller_id, created_at")
    .eq("status", "closed")
    .order("week_end_date", { ascending: false })
    .limit(8);
  const history = histQ.data ?? [];

  const historyWinnerIds = history.map((h: any) => h.winner_seller_id).filter(Boolean);
  const histWinnersQ = historyWinnerIds.length > 0
    ? await supabase.from("profiles").select("id, business_name, full_name, slug").in("id", historyWinnerIds as any)
    : Promise.resolve({ data: [] } as any);
  const histWinnersMap = new Map<string, any>(((await histWinnersQ).data ?? []).map((p: any) => [p.id, p]));

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <header className="sticky top-0 z-40 border-b border-black/[.08] dark:border-white/[.145] bg-white/90 dark:bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="font-bold inline-flex items-center gap-2">
            🏬 {siteName}
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">الرئيسية</Link>
            <Link href="/search" className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">البحث</Link>
            <Link href="/needs" className="px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">الاحتياجات</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {!active && history.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🗳️</div>
            <h1 className="text-2xl font-bold mb-2">لا يوجد استفتاء حالياً</h1>
            <p className="text-black/60 dark:text-white/60 mb-6">
              تم إغلاق الاستفتاءات أو لم يتم إنشاؤها بعد. تابعنا قريبًا للاستفتاء القادم.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 font-semibold"
            >
              عودة للرئيسية
            </Link>
          </div>
        ) : (
          <>
            {/* Hero + active poll */}
            <section className="mb-10">
              <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-sky-500 to-indigo-600 text-white p-8 mb-6 shadow-xl">
                <div className="flex items-center gap-2 text-xs opacity-90 mb-2">
                  🗳️ الاستفتاء الأسبوعي · من {new Date(active?.week_start_date ?? Date.now()).toLocaleDateString("ar-SA")} إلى {new Date(active?.week_end_date ?? Date.now()).toLocaleDateString("ar-SA")}
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold mb-2 leading-tight">
                  {active?.title ?? "أفضل بائع في الزلفي هذا الأسبوع"}
                </h1>
                {active?.description && (
                  <p className="text-white/90 max-w-2xl">{active.description}</p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                  <span className="rounded-full bg-white/15 px-3 py-1.5">
                    إجمالي الأصوات: <b>{(active?.total_votes ?? 0).toLocaleString("ar-SA")}</b>
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1.5">
                    {active?.status === "active" ? "✓ الاستفتاء مفتوح للتصويت" : "🔒 تم إغلاق الاستفتاء"}
                  </span>
                </div>
              </div>

              {active && (
                <PollVoteClient
                  pollId={active.id}
                  status={active.status}
                  totalVotes={active.total_votes ?? 0}
                  myVoteOptionId={active.my_vote_option_id ?? null}
                  options={optionsWithProfiles}
                  results={resultsWithProfiles}
                  viewerId={user.id}
                />
              )}
            </section>

            {/* History */}
            {history.length > 0 && (
              <section className="mt-12">
                <h2 className="text-xl font-bold mb-4 inline-flex items-center gap-2">
                  🏆 سابقو الفوز بالاستفتاء
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {history.map((h: any) => {
                    const winner = h.winner_seller_id ? histWinnersMap.get(h.winner_seller_id) : null;
                    return (
                      <div
                        key={h.id}
                        className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-5 bg-white dark:bg-black/10"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold">{h.title}</h3>
                          <span className="text-[11px] opacity-60">
                            {new Date(h.week_start_date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })} — {new Date(h.week_end_date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        {winner ? (
                          <div className="mt-3 flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-500/0 p-3 border border-amber-500/20">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-bold shadow shrink-0">
                              👑
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-amber-700 dark:text-amber-300 font-bold mb-0.5">
                                الفائز هذا الأسبوع
                              </div>
                              <Link
                                href={`/seller/${winner.slug ?? winner.id}`}
                                className="font-bold truncate block hover:underline"
                              >
                                {winner.business_name || winner.full_name || "بائع"}
                              </Link>
                            </div>
                            <span className="text-xs opacity-60 shrink-0">#{h.id}</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-black/50">
                            لم يتم إعلان الفائز بعد أو تعذّر إكمال الاحصاء.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
