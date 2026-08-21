"use client";

import { useEffect, useRef } from "react";

// Records where a seller-profile visit came from — currently only `?src=qr`,
// set by the printed QR poster (app/dashboard/qr).
//
// Client-side rather than in the server component on purpose: /seller/[slug] is
// cached, so a server-side write would only fire on cache misses and would
// under-count badly. A one-shot effect fires once per real page view.
export default function VisitSourceTracker({
  sellerId,
  source,
}: {
  sellerId: string;
  source: string | undefined;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (!source || sent.current) return;
    // The RPC validates the channel and ignores anything it doesn't know, so an
    // arbitrary ?src= value in the URL can't create junk rows.
    sent.current = true;

    fetch("/api/seller-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId, channel: source }),
      keepalive: true,
    }).catch(() => {});
  }, [sellerId, source]);

  return null;
}
