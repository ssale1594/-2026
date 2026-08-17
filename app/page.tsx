import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { siteName, siteUrl } from "@/lib/seo";
import SearchBox from "@/components/search-box";
import NeighborhoodSelect from "@/components/neighborhood-select";
import SponsorBanner from "@/components/sponsor-banner";
import { getNeighborhoods } from "@/lib/data/neighborhoods";
import { getJourneys } from "@/lib/data/journeys";
import { getSponsorship } from "@/lib/data/sponsorships";
import ListingCard from "@/components/listing-card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: `${siteName} — دليل محلات الخدمات والمنتجات في الزلفي`,
  description:
    "سوق الزلفي المحلي — تصفح الإعلانات، أطلب خدمات من جيرانك، أو أضف متجرك مجانًا. الأسعار المعروضة من الباعة مباشرة.",
  metadataBase: new URL(siteUrl),
};

type ListingRow = any;

// Used as a `.map()` callback, so it takes one row — not the whole array.
function enhanceRow(row: ListingRow): ListingRow {
  return { ...row };
}

export default async function Home() {
  const supabase = await createClient();

  // Resolved before the batch below: one of those queries personalizes on the
  // signed-in user, and reading it out of the same destructuring it belongs to
  // is a temporal-dead-zone throw, not just a type error.
  const { data: userRow } = await supabase.auth.getUser();

  const [
    { data: categories },
    neighborhoods,
    journeys,
    sponsorship,
    { data: statsRows },
    { data: topCats },
    { data: neighActivity },
    recentRaw,
    viewedRaw,
    contactedRaw,
    offersRaw,
    dailyOffersRaw,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name_ar, slug, parent_id, icon_emoji")
      .eq("is_active", true)
      .order("sort_order"),
    getNeighborhoods(),
    getJourneys(),
    getSponsorship("home"),
    supabase.rpc("home_overall_stats"),
    supabase.rpc("home_top_categories", { p_limit: 12 }),
    supabase.rpc("home_neighborhoods_activity", { p_limit: 10 }),
    (async () => {
      const q = await (supabase.rpc as any)("home_recent_listings", { p_limit: 12 });
      const ids = (q.data ?? []).map((x: any) => x.id);
      if (ids.length === 0) return [];
      const fullQ = await supabase
        .from("listings")
        .select(
          "id, title, slug, status, price, price_negotiable, view_count, contact_click_count, created_at, " +
            "categories(name_ar), neighborhoods(name_ar, slug), profiles(business_name, slug, trust_level, verification_status), " +
            "listing_images(storage_path, is_primary)"
        )
        .in("id", ids);
      const map = new Map((fullQ.data ?? []).map((x: any) => [x.id, x]));
      return ids
        .map((id: any) => map.get(id))
        .filter(Boolean)
        .map(enhanceRow);
    })(),
    (async () => {
      const q = await (supabase.rpc as any)("home_top_viewed", { p_limit: 8 });
      const ids = (q.data ?? []).map((x: any) => x.id);
      if (ids.length === 0) return [];
      const fullQ = await supabase
        .from("listings")
        .select(
          "id, title, slug, status, price, price_negotiable, view_count, contact_click_count, created_at, " +
            "categories(name_ar), neighborhoods(name_ar, slug), profiles(business_name, slug, trust_level, verification_status), " +
            "listing_images(storage_path, is_primary)"
        )
        .in("id", ids);
      const map = new Map((fullQ.data ?? []).map((x: any) => [x.id, x]));
      return ids
        .map((id: any) => map.get(id))
        .filter(Boolean)
        .map(enhanceRow);
    })(),
    (async () => {
      const q = await (supabase.rpc as any)("home_top_contacts", { p_limit: 6 });
      const ids = (q.data ?? []).map((x: any) => x.id);
      if (ids.length === 0) return [];
      const fullQ = await supabase
        .from("listings")
        .select(
          "id, title, slug, status, price, price_negotiable, view_count, contact_click_count, created_at, " +
            "categories(name_ar), neighborhoods(name_ar, slug), profiles(business_name, slug, trust_level, verification_status), " +
            "listing_images(storage_path, is_primary)"
        )
        .in("id", ids);
      const map = new Map((fullQ.data ?? []).map((x: any) => [x.id, x]));
      return ids
        .map((id: any) => map.get(id))
        .filter(Boolean)
        .map(enhanceRow);
    })(),
    // user personalization: same neighborhood + favorite categories based on activity
    (async () => {
      const uid = userRow?.user?.id;
      if (!uid) return [];
      const userQ = await supabase
        .from("profiles")
        .select("neighborhood_id")
        .eq("id", uid)
        .maybeSingle();
      const nid = (userQ.data as any)?.neighborhood_id;
      if (!nid) return [];
      const fullQ = await supabase
        .from("listings")
        .select(
          "id, title, slug, status, price, price_negotiable, view_count, contact_click_count, created_at, " +
            "categories(name_ar), neighborhoods(name_ar, slug), profiles(business_name, slug, trust_level, verification_status), " +
            "listing_images(storage_path, is_primary)"
        )
        .eq("status", "published")
        .eq("neighborhood_id", nid)
        .order("created_at", { ascending: false })
        .limit(8);
      return (fullQ.data ?? []).map(enhanceRow);
    })(),
    (async () => {
      // اليومي من جدول daily_offers إن وجد
      const q = await supabase
        .from("daily_offers")
        .select(
          "listing_id, listings!inner(id, title, slug, status, price, price_negotiable, view_count, contact_click_count, created_at, " +
            "categories(name_ar), neighborhoods(name_ar, slug), profiles(business_name, slug, trust_level, verification_status), " +
            "listing_images(storage_path, is_primary))"
        )
        .gte("expires_at", new Date().toISOString())
        .is("archived_at", null)
        .order("discount_percent", { ascending: false })
        .limit(8);
      return (q.data ?? []).map((x: any) => ({
        ...x.listings,
        discount_percent: x.discount_percent ?? null,
      }));
    })(),
  ]);

  const stats = (statsRows ?? []).reduce((acc: any, row: any) => {
    acc[row.kpi] = Number(row.val);
    return acc;
  }, {} as Record<string, number>);

  const rootCats = (categories ?? []).filter((c: any) => c.parent_id == null).slice(0, 8);
  const remainingCats = (topCats ?? []).filter(
    (c: any) => !rootCats.find((r: any) => r.id === c.id)
  );
  const topCatsAugmented = [...rootCats.map((r) => ({ ...r, listings_count: (topCats ?? []).find((t: any) => t.id === (r as any).id)?.listings_count ?? 0 })), ...(remainingCats ?? [])].slice(
    0,
    12
  );

  const user = userRow?.user;
  const showNeigh = offersRaw.length > 0;
  const showDaily = dailyOffersRaw.length > 0;
  const showContacts = contactedRaw.length > 0;

  return (
    <div className="min-h-screen font-sans">
      <header className="sticky top-0 z-40 border-b border-black/[.08] dark:border-white/[.145] bg-white/90 dark:bg-black/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-extrabold shrink-0 inline-flex items-center gap-2">
            🏬 {siteName}
          </Link>
          <nav className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm text-black/65 dark:text-white/70">
            <Link href="/search" className="hover:underline">
              🔎 البحث المتقدم
            </Link>
            <Link href="/offers" className="hover:underline">
              💸 عروض اليوم
            </Link>
            <Link href="/needs" className="hover:underline">
              🙋 احتياجات الجيران
            </Link>
            <Link href="/polls" className="hover:underline">
              🗳️ الاستفتاء الأسبوعي
            </Link>
            <Link href="/jobs" className="hover:underline">
              💼 وظائف
            </Link>
            <Link href="/events" className="hover:underline">
              🎪 فعاليات
            </Link>
            <Link href="/my/favorites" className="hover:underline font-semibold text-rose-600">
              ❤️ المفضلة
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* HERO */}
        <section className="mb-8 rounded-3xl bg-gradient-to-br from-sky-600 via-indigo-600 to-violet-700 text-white p-6 md:p-10 shadow-2xl overflow-hidden relative">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
            <div className="lg:col-span-3">
              <div className="text-[11px] opacity-90 mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 border border-white/20">
                ✨ سوق الزلفي المحلي · مدعوم من جيرانك
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold mb-3 leading-tight">
                كل اللي تحتاجه في الزلفي،
                <br className="hidden sm:block" /> عند بائعك الموثوق
              </h1>
              <p className="text-white/90 max-w-2xl mb-6 md:text-lg">
                إعلانات من المزارع والأسر المنتجة والمحلات الخدمية داخل الزلفي — بدون وسطاء، تواصل مباشر عبر الواتساب، ومستويات ثقة معتمدة من جيرانك.
              </p>
              <div className="max-w-2xl mb-5">
                <SearchBox size="lg" showVoice placeholder="ابحث عن: دراجة، كهربائي، فطور لـ30 شخص..." />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/needs/new"
                  className="rounded-xl bg-white text-indigo-700 font-bold px-5 py-2.5 text-sm shadow hover:shadow-lg transition"
                >
                  🙋 أنشر احتياجك مجانًا
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/40 bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 text-sm transition"
                >
                  🏪 أضف متجرك أو إعلانك
                </Link>
                <Link
                  href="/polls"
                  className="rounded-xl border border-white/20 text-white/95 font-bold px-5 py-2.5 text-sm hover:bg-white/10 transition"
                >
                  🗳️ صوّت لأفضل بائع الأسبوع
                </Link>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="إعلان نشط" value={stats.listings_total} />
                <Stat label="بائع معتمد" value={stats.sellers_total} />
                <Stat label="إضافة الأسبوع" value={stats.listings_week} accent />
                <Stat label="اتصال واتساب آخر 7 أيام" value={stats.contacts_week} accent />
              </div>
            </div>
          </div>
        </section>

        <SponsorBanner sponsorship={sponsorship} />

        {/* NEEDS CTA */}
        <section className="mb-10 rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-center gap-2">
              💡 ما لقيت اللي تبيه؟ أنشر طلبك كـ"احتياج" وخلّ البائعين يأتون لك!
            </div>
            <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80 mt-0.5 max-w-2xl">
              مثال: "أحتاج شاحنة نقل أثاث من حي القديمة إلى الروضة — ميزانية 350 ر.س" الباعة المناسبين يتواصلون معك مباشرة.
            </p>
          </div>
          <Link
            href="/needs/new"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 text-sm shrink-0 shadow"
          >
            ✍️ أحتاج إلى...
          </Link>
        </section>

        {/* CATEGORIES */}
        {topCatsAugmented.length > 0 && (
          <section className="mb-10">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold inline-flex items-center gap-2">
                  🗂️ تصفح حسب الفئة
                </h2>
                <p className="text-sm text-black/55 dark:text-white/60 mt-0.5">
                  كل فئة تحتوي على العدد الفعلي للإعلانات المنشورة الآن
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {topCatsAugmented.map((c: any) => {
                const count = c.listings_count ?? 0;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/category/${c.slug}`}
                      className="group block rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 hover:shadow-md hover:-translate-y-0.5 transition bg-white dark:bg-black/5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <span className="text-2xl" aria-hidden>
                          {c.icon_emoji || "📂"}
                        </span>
                        <span className="text-[10px] rounded-full bg-black/[.06] dark:bg-white/[.08] px-2 py-0.5 font-bold opacity-80">
                          {count.toLocaleString("ar-SA")} إعلان
                        </span>
                      </div>
                      <div className="font-bold group-hover:text-sky-700 dark:group-hover:text-sky-300">
                        {c.name_ar}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* NEIGHBORHOODS ACTIVITY */}
        {(neighActivity ?? []).length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold inline-flex items-center gap-2 mb-4">
              📍 الأحياء الأكثر نشاطًا الآن
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {(neighActivity ?? []).map((n: any) => (
                <Link
                  key={n.id}
                  href={`/neighborhood/${n.slug}`}
                  className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-4 hover:bg-black/[.03] dark:hover:bg-white/[.05] transition"
                >
                  <div className="font-bold mb-0.5">🏘️ {n.name_ar}</div>
                  <div className="text-[11px] opacity-70 flex flex-wrap gap-x-2">
                    <span>📦 {n.listings_count}</span>
                    <span>🏪 {n.sellers_count}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-black/[.06] dark:bg-white/[.08] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                      style={{
                        width: `${Math.min(100, Math.max(8, ((n.recent_views || 0) / Math.max(1, neighActivity?.[0]?.recent_views || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
            {neighborhoods.length > 0 && (
              <div className="mt-4">
                <NeighborhoodSelect neighborhoods={neighborhoods} />
              </div>
            )}
          </section>
        )}

        {/* DAILY OFFERS */}
        {showDaily && (
          <Section title="🔥 عروض اليوم الحصرية" subtitle="خصم محدود الوقت من بائعين معتمدين" link="/offers">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {(dailyOffersRaw as any[]).slice(0, 4).map((l) => (
                <div key={l.id} className="relative">
                  {l.discount_percent ? (
                    <span className="absolute -top-2 right-2 z-20 text-[11px] rounded-full bg-rose-600 text-white px-2.5 py-0.5 font-bold shadow">
                      خصم {l.discount_percent}%
                    </span>
                  ) : null}
                  <ListingCard listing={l} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* RECENT */}
        {recentRaw.length > 0 && (
          <Section title="✨ أحدث الإعلانات" subtitle="أضيف الآن إلى السوق" link="/search">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(recentRaw as any[]).slice(0, 8).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </Section>
        )}

        {/* PERSONALIZED NEIGHBORHOOD */}
        {showNeigh && (
          <Section
            title={user ? "🏡 إعلانات حيك المفضل" : "🏡 في حي الزلفي"}
            subtitle={
              user
                ? "من نفس الحي اللي اخترته في حسابك — أسرع توصيل وأقرب جيران"
                : "من أقرب بائع الزلفي — توصيل أو استلام شخصي"
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(offersRaw as any[]).slice(0, 4).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </Section>
        )}

        {/* TOP VIEWED */}
        {viewedRaw.length > 0 && (
          <Section title="👀 الأكثر مشاهدة هذا الشهر" subtitle="اللي زاره عدد كبير من الجيران">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(viewedRaw as any[]).slice(0, 4).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </Section>
        )}

        {/* TOP CONTACTED (high conversion) */}
        {showContacts && (
          <Section
            title="💬 الأكثر اتصالات من الزوار (أعلى جودة)"
            subtitle="كل إعلان هنا له نسبة تحويل عالية = عروض جدية من باعة موثوقين"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(contactedRaw as any[]).slice(0, 6).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </Section>
        )}

        {/* JOURNEYS */}
        {journeys.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold inline-flex items-center gap-2 mb-1">
              🧭 تجهّز لمناسبتك
            </h2>
            <p className="text-sm text-black/55 dark:text-white/60 mb-5">
              خطوات جاهزة لكل مناسبة — كل اللي تحتاجه في مكان واحد.
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {journeys.map((journey: any) => (
                <li key={journey.id}>
                  <Link
                    href={`/journey/${journey.slug}`}
                    className="block rounded-2xl border border-black/[.08] dark:border-white/[.145] p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition bg-gradient-to-br from-amber-500/5 to-rose-500/5"
                  >
                    <div className="text-4xl mb-1.5" aria-hidden>
                      {journey.icon_emoji || "🎊"}
                    </div>
                    <div className="font-bold">{journey.name_ar}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-black/[.08] dark:border-white/[.145] mt-12">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap gap-4 text-xs text-black/50 dark:text-white/50 items-center justify-between">
          <nav className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:underline">
              سياسة الخصوصية
            </Link>
            <Link href="/terms" className="hover:underline">
              الشروط والأحكام
            </Link>
            <Link href="/refund" className="hover:underline">
              سياسة الاسترجاع
            </Link>
            <Link href="/whats-new" className="hover:underline">
              ماذا يوجد جديد؟
            </Link>
            <Link href="/refer-a-business" className="hover:underline">
              رشّح مشروعًا
            </Link>
          </nav>
          <span className="opacity-75">© {new Date().getFullYear()} {siteName} — سوق الزلفي المحلي 🇸🇦</span>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  subtitle,
  link,
  children,
}: {
  title: string;
  subtitle?: string;
  link?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold inline-flex items-center gap-2">{title}</h2>
          {subtitle && <p className="text-sm text-black/55 dark:text-white/60 mt-0.5">{subtitle}</p>}
        </div>
        {link && (
          <Link
            href={link}
            className="text-sm rounded-lg border border-black/[.12] dark:border-white/[.2] px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 font-semibold"
          >
            عرض الكل ←
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl p-4 backdrop-blur border",
        accent
          ? "bg-white/15 border-white/25 shadow-inner"
          : "bg-white/10 border-white/15",
      ].join(" ")}
    >
      <div className="text-[11px] opacity-85 mb-1">{label}</div>
      <div className="text-2xl md:text-3xl font-extrabold leading-none">
        {Number(value).toLocaleString("ar-SA")}
      </div>
    </div>
  );
}
