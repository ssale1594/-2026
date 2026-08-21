import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SellerDetail = {
  id: string;
  slug: string;
  business_name: string;
  business_type: string;
  description: string | null;
  whatsapp_number: string;
  // Added by migration 55. Null until it is applied — see the fallback below.
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  address_note: string | null;
  neighborhood_id: number | null;
};

const BASE_COLUMNS =
  "id, slug, business_name, business_type, description, whatsapp_number";

const LOCATION_COLUMNS =
  "phone, latitude, longitude, address_note, neighborhood_id";

export const getSellerBySlug = cache(async (slug: string) => {
  const supabase = await createClient();

  const query = (columns: string) =>
    supabase
      .from("sellers")
      .select(columns)
      .eq("slug", slug)
      .eq("verification_status", "approved")
      .single<SellerDetail>();

  const withLocation = await query(`${BASE_COLUMNS}, ${LOCATION_COLUMNS}`);

  if (!withLocation.error) {
    return withLocation.data;
  }

  // Deploys land before the SQL is pasted into Supabase's editor by hand, so
  // there is always a window where the code asks for columns the database
  // doesn't have yet. Without this fallback that window turned every seller
  // page into a 404 — the single most important public page in the app.
  // 42703 = undefined_column.
  if (withLocation.error.code !== "42703") {
    return null;
  }

  const base = await query(BASE_COLUMNS);
  if (base.error || !base.data) return null;

  return {
    ...base.data,
    phone: null,
    latitude: null,
    longitude: null,
    address_note: null,
    neighborhood_id: null,
  } satisfies SellerDetail;
});
