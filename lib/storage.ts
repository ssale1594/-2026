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

// Seller avatars. `sellers.logo_url` holds an absolute URL, while the poll RPCs
// hand back a storage path in the same public bucket as listing images — this
// accepts either. Returns undefined when there is nothing to show, so callers
// fall back to their initial-letter avatar instead of requesting a broken URL.
export function profileImageUrl(
  pathOrUrl?: string | null
): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return listingImageUrl(pathOrUrl);
}

// ============================================================
// Payment proofs — private bucket, signed URLs from server.
// Path: {deal_id}/{userId}/{fileId}.webp or .pdf
// ============================================================

const ACCEPTED_PAYMENT_MIMES = [
  "image/jpeg", "image/png", "image/webp", "application/pdf",
];

export async function uploadPaymentProof(
  dealId: string | number,
  userId: string,
  file: File
): Promise<{ path: string; mime: string; bytes: number; filename: string }> {
  if (!ACCEPTED_PAYMENT_MIMES.includes(file.type) && !/\.(jpe?g|png|webp|pdf)$/i.test(file.name))
    throw new Error("نقبل صور (JPG/PNG/WebP) أو PDF فقط.");
  if (file.size > 10 * 1024 * 1024) throw new Error("الحد الأقصى للمرفق 10 ميجابايت.");

  let blob: Blob = file;
  let ext = "bin";
  let mime = file.type || "application/octet-stream";

  // إذا كانت صورة (وليس PDF) نضغطها إلى WebP كما في TECH.md §4 لتقليل الحجم
  if (file.type.startsWith("image/") && file.type !== "application/pdf") {
    try {
      blob = await compressToWebp(file, 1400, 0.82);
      mime = "image/webp";
      ext = "webp";
    } catch {
      // fallback إلى الملف الأصلي إذا فشل الضغط (مثل ملف مكسور)
    }
  } else if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    mime = "application/pdf";
    ext = "pdf";
  } else {
    // استخراج الامتداد من اسم الملف
    const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
    if (m) ext = m[1].toLowerCase();
  }

  const path = `${dealId}/${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw error;
  return { path, mime, bytes: blob.size || file.size, filename: file.name };
}
