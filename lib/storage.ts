import { createClient } from "@/lib/supabase/client";

// TECH.md §4 — compress client-side to WebP before upload; never store the
// original multi-MB photo. Canvas keeps this dependency-free.
export async function compressToWebp(
  file: File,
  maxDimension = 1600,
  quality = 0.8
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر معالجة الصورة");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("تعذّر ضغط الصورة"))),
      "image/webp",
      quality
    );
  });
}

export async function uploadListingImage(
  sellerId: string,
  listingId: string,
  file: File
): Promise<string> {
  const compressed = await compressToWebp(file);
  const path = `${sellerId}/${listingId}/${crypto.randomUUID()}.webp`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("listing-images")
    .upload(path, compressed, { contentType: "image/webp" });

  if (error) throw error;
  return path;
}

// Plain string concatenation instead of the SDK's getPublicUrl — this bucket is
// public, so no auth is needed, and this way the helper works in Server
// Components too without spinning up a Supabase client just to build a URL.
export function listingImageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${storagePath}`;
}
