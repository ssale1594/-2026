import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, siteName } from "@/lib/seo";
import SellerContactButtons from "@/components/seller-contact-buttons";
import { directionsHref } from "@/lib/geo";
import SiteNav from "@/components/site-nav";
import ClaimButton from "./claim-button";

export const metadata = {
  title: pageTitle("دليل الزلفي على الخريطة"),
  description:
    "دليل محلات وأسر ومقدّمي خدمات الزلفي: الموقع على الخريطة، الاتجاهات، وأرقام التواصل المباشر.",
};

export const revalidate = 600;

type DirectoryRow = {
  id: string;
  business_name: string;
  slug: string;
  business_type: string | null;
  description: string | null;
  whatsapp_number: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  address_note: string | null;
  neighborhood_id: number | null;
  neighborhood_name: string | null;
  listing_count: number;
};

type UnclaimedRow = {
  id: string;
  business_name: string;
  category_name: string | null;
  neighborhood_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  latitude: number | null;
  longitude: number | null;
  address_note: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  shop: "🏪 محل",
  home_producer: "🏠 أسرة منتجة",
  service_provider: "🔧 خدمات",
  real_estate_agent: "🏘️ عقار",
  individual: "👤 فرد",
};

// الزلفي — مركز تقريبي، يُستخدم فقط لتأطير الخريطة المضمّنة.
const ZULFI_CENTER = { lat: 26.2994, lon: 44.8144 };

// OpenStreetMap's embed endpoint needs no API key and no client-side JS, which
// keeps this page a plain server component and keeps the project at zero paid
// dependencies (TECH.md "مبدأ التكلفة"). A full interactive map with per-seller
// pins would mean shipping Leaflet + a tile budget; the list below already
// gives every seller a one-tap "الاتجاهات" link into the user's real maps app,
// which is what someone standing in the street actually wants.
function osmEmbedSrc(rows: { latitude: number | null; longitude: number | null }[]): string {
  const located = rows.filter((r) => r.latitude !== null && r.longitude !== null);

  if (located.length === 0) {
    const d = 0.03;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${
      ZULFI_CENTER.lon - d
    },${ZULFI_CENTER.lat - d},${ZULFI_CENTER.lon + d},${ZULFI_CENTER.lat + d}&layer=mapnik`;
  }

  const lats = located.map((r) => Number(r.latitude));
  const lons = located.map((r) => Number(r.longitude));
  const pad = 0.01;
  const bbox = [
    Math.min(...lons) - pad,
    Math.min(...lats) - pad,
    Math.max(...lons) + pad,
    Math.max(...lats) + pad,
  ].join(",");

  // A single marker only makes sense when there's exactly one point; for many,
  // the bbox framing is what carries the information.
  const marker =
    located.length === 1
      ? `&marker=${located[0].latitude},${located[0].longitude}`
      : "";

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker}`;
}

export default async function MapDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ hay?: string }>;
}) {
  const { hay } = await searchParams;
  const neighborhoodId = hay ? Number(hay) : null;

  const supabase = await createClient();

  const [dirQ, publicDirQ, hoodsQ] = await Promise.all([
    supabase.rpc("map_directory", {
      p_neighborhood_id:
        neighborhoodId && Number.isFinite(neighborhoodId) ? neighborhoodId : null,
    }),
    // Includes unclaimed public-directory entries too (PLAN.md §23) — public
    // sourced info for businesses that haven't signed up yet, so the site has
    // useful content from day one instead of only registered sellers.
    supabase.rpc("public_directory", {
      p_neighborhood_id:
        neighborhoodId && Number.isFinite(neighborhoodId) ? neighborhoodId : null,
    }),
    supabase.from("neighborhoods").select("id, name_ar").order("name_ar"),
  ]);

  const rows = (dirQ.data ?? []) as DirectoryRow[];
  const hoods = (hoodsQ.data ?? []) as { id: number; name_ar: string }[];
  const unclaimed = (
    ((publicDirQ.data ?? []) as (UnclaimedRow & { source: string })[]).filter(
      (r) => r.source === "directory"
    )
  ) as UnclaimedRow[];

  const located = rows.filter((r) => r.latitude !== null && r.longitude !== null);
  const unlocated = rows.filter((r) => r.latitude === null || r.longitude === null);

  return (
    <div className="min-h-screen font-sans">
      <header className="relative border-b border-black/[.08] dark:border-white/[.145]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold shrink-0">
            {siteName}
          </Link>
          <SiteNav />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-1">🗺️ دليل الزلفي</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          محلات وأسر منتجة ومقدّمو خدمات بالزلفي — الموقع، الاتجاهات، والتواصل
          المباشر.
        </p>

        <div className="rounded-xl overflow-hidden border border-black/[.08] dark:border-white/[.145] mb-6">
          <iframe
            title="خريطة الزلفي"
            src={osmEmbedSrc([...rows, ...unclaimed])}
            className="w-full h-[320px] sm:h-[420px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {hoods.length > 0 && (
          <nav className="flex flex-wrap gap-2 mb-6 text-sm">
            <Link
              href="/map"
              className={`rounded-full px-3 py-1.5 border ${
                !neighborhoodId
                  ? "bg-foreground text-background border-transparent"
                  : "border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              كل الأحياء
            </Link>
            {hoods.map((h) => (
              <Link
                key={h.id}
                href={`/map?hay=${h.id}`}
                className={`rounded-full px-3 py-1.5 border ${
                  neighborhoodId === h.id
                    ? "bg-foreground text-background border-transparent"
                    : "border-black/[.12] dark:border-white/[.2] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {h.name_ar}
              </Link>
            ))}
          </nav>
        )}

        {rows.length === 0 && unclaimed.length === 0 ? (
          <p className="rounded-lg border border-black/[.08] dark:border-white/[.145] px-4 py-8 text-center text-sm text-black/60 dark:text-white/60">
            ما فيه بائعون معتمدون بهذا الحي بعد.
          </p>
        ) : (
          <>
            <SellerGrid rows={located} />

            {unlocated.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">
                  بائعون ما حدّدوا موقعهم بعد ({unlocated.length})
                </h2>
                <SellerGrid rows={unlocated} />
              </section>
            )}

            {unclaimed.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3">
                  📖 معلومات عامة — أصحابها ما سجّلوا بعد ({unclaimed.length})
                </h2>
                <DirectoryGrid rows={unclaimed} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DirectoryGrid({ rows }: { rows: UnclaimedRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((entry) => {
        const directions = directionsHref(entry.latitude, entry.longitude);
        return (
          <article
            key={entry.id}
            className="rounded-xl border border-dashed border-black/[.15] dark:border-white/[.2] p-4 flex flex-col gap-3"
          >
            <div className="min-w-0">
              <div className="font-bold truncate">{entry.business_name}</div>
              <p className="text-xs text-black/55 dark:text-white/55 mt-0.5">
                {entry.category_name}
                {entry.neighborhood_name && ` · ${entry.neighborhood_name}`}
              </p>
            </div>

            {entry.address_note && (
              <p className="text-xs text-black/60 dark:text-white/60">
                {entry.address_note}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {entry.whatsapp_number && (
                <a
                  href={`https://wa.me/${entry.whatsapp_number.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-green-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-green-700"
                >
                  واتساب
                </a>
              )}
              {entry.phone && (
                <a
                  href={`tel:${entry.phone.replace(/[^\d+]/g, "")}`}
                  className="rounded-full border border-black/[.12] dark:border-white/[.2] text-xs font-medium px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  📞 اتصال
                </a>
              )}
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-black/[.12] dark:border-white/[.2] text-xs font-medium px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  📍 الاتجاهات
                </a>
              )}
              <ClaimButton directoryEntryId={entry.id} businessName={entry.business_name} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SellerGrid({ rows }: { rows: DirectoryRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((seller) => (
        <article
          key={seller.id}
          className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-4 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/seller/${seller.slug}`}
                className="font-bold hover:underline block truncate"
              >
                {seller.business_name}
              </Link>
              <p className="text-xs text-black/55 dark:text-white/55 mt-0.5">
                {seller.business_type
                  ? TYPE_LABEL[seller.business_type] ?? seller.business_type
                  : null}
                {seller.neighborhood_name && ` · ${seller.neighborhood_name}`}
                {seller.listing_count > 0 && ` · ${seller.listing_count} إعلان`}
              </p>
            </div>
            {directionsHref(seller.latitude, seller.longitude) && (
              <span className="text-xs shrink-0 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                📍 على الخريطة
              </span>
            )}
          </div>

          {seller.address_note && (
            <p className="text-xs text-black/60 dark:text-white/60">
              {seller.address_note}
            </p>
          )}

          <SellerContactButtons
            sellerId={seller.id}
            businessName={seller.business_name}
            whatsappNumber={seller.whatsapp_number}
            phone={seller.phone}
            latitude={seller.latitude}
            longitude={seller.longitude}
            compact
          />
        </article>
      ))}
    </div>
  );
}
