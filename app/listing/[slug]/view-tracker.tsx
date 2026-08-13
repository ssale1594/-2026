"use client";

import { useEffect, useRef } from "react";

export default function ViewTracker({ listingId }: { listingId: string }) {
  const hasTracked = useRef(false);

  useEffect(() => {
    // React runs effects twice in dev StrictMode — the ref keeps one view per mount.
    if (hasTracked.current) return;
    hasTracked.current = true;

    fetch("/api/listing-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    }).catch(() => {});
  }, [listingId]);

  return null;
}
