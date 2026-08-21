"use client";

import { siteName } from "@/lib/seo";

export type ContactChannel = "whatsapp" | "phone" | "directions";

// Fire-and-forget: the tracking call must never delay or block the action.
// TECH.md §9 is explicit about this — if analytics fails, WhatsApp still opens.
function track(sellerId: string, channel: ContactChannel) {
  fetch("/api/seller-contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sellerId, channel }),
    keepalive: true,
  }).catch(() => {});
}

export function directionsHref(
  latitude: number | null,
  longitude: number | null
): string | null {
  if (latitude === null || longitude === null) return null;
  // The universal Google Maps directions URL — works in the app on both phone
  // platforms and falls back to the web without needing an API key.
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export default function SellerContactButtons({
  sellerId,
  businessName,
  whatsappNumber,
  phone,
  latitude,
  longitude,
  compact = false,
}: {
  sellerId: string;
  businessName: string;
  whatsappNumber: string;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  compact?: boolean;
}) {
  // wa.me requires digits only (country code, no leading +/00/spaces).
  const waHref = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
    `مرحبًا، وصلت لكم عن طريق ${siteName} وحاب أستفسر عن ${businessName}.`
  )}`;
  const directions = directionsHref(latitude ?? null, longitude ?? null);

  const size = compact ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2";

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "items-center"}`}>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track(sellerId, "whatsapp")}
        className={`rounded-full bg-green-600 text-white font-medium hover:bg-green-700 transition-colors ${size}`}
      >
        واتساب
      </a>

      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          onClick={() => track(sellerId, "phone")}
          className={`rounded-full border border-black/[.12] dark:border-white/[.2] font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${size}`}
        >
          📞 اتصال
        </a>
      )}

      {directions && (
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(sellerId, "directions")}
          className={`rounded-full border border-black/[.12] dark:border-white/[.2] font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${size}`}
        >
          📍 الاتجاهات
        </a>
      )}
    </div>
  );
}
