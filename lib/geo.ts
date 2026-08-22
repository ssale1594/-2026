// Turning whatever a seller pastes into a lat/lng pair.
//
// Asking a shop owner for "latitude and longitude" gets you nothing. What they
// can do is open Google Maps, long-press their shop, and hit share — so this
// accepts the handful of shapes that actually come out of that flow, plus a
// plain "lat, lng" for anyone who knows what they're doing.
//
// Deliberately not handling short links (maps.app.goo.gl / goo.gl/maps): those
// only resolve by following a redirect, which means a server-side fetch to an
// external host on user-supplied input. The form tells the seller to open the
// short link first and paste the full one instead.

export type Coordinates = { latitude: number; longitude: number };

// Al-Zulfi sits near 26.30°N, 44.81°E. A generous box around it catches the
// most common paste error — swapped lat/lng — without rejecting outlying farms.
const ZULFI_BOX = { minLat: 25.8, maxLat: 26.8, minLon: 44.2, maxLon: 45.4 };

function valid(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function parseCoordinates(input: string): Coordinates | null {
  const text = input.trim();
  if (!text) return null;

  const patterns: RegExp[] = [
    // .../@26.2994,44.8144,17z  — the URL you get from the address bar
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    // ...?q=26.2994,44.8144  /  ...&query=26.2994,44.8144  /  ...!3d26.29!4d44.81
    /[?&](?:q|query|ll|daddr|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    // bare "26.2994, 44.8144"
    /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lon = Number(match[2]);
      if (valid(lat, lon)) return { latitude: lat, longitude: lon };
    }
  }

  return null;
}

/** True when the point is nowhere near Al-Zulfi — usually a swapped pair. */
export function looksOutsideZulfi({ latitude, longitude }: Coordinates): boolean {
  return (
    latitude < ZULFI_BOX.minLat ||
    latitude > ZULFI_BOX.maxLat ||
    longitude < ZULFI_BOX.minLon ||
    longitude > ZULFI_BOX.maxLon
  );
}

/** Suggests the swap when the pasted pair is backwards. */
export function swapped({ latitude, longitude }: Coordinates): Coordinates {
  return { latitude: longitude, longitude: latitude };
}

// The universal Google Maps directions URL — works in the app on both phone
// platforms and falls back to the web without needing an API key.
//
// Lives in this plain module rather than components/seller-contact-buttons.tsx
// (a "use client" file) because app/map/page.tsx is a Server Component: Next's
// RSC bundler treats every export of a "use client" module as a client
// reference, even a pure non-React function, so calling it directly from a
// Server Component throws at render time. This only surfaced once real seller
// rows with coordinates existed — with empty data the map/[slug] grids
// short-circuited before ever calling it.
export function directionsHref(
  latitude: number | null,
  longitude: number | null
): string | null {
  if (latitude === null || longitude === null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
