"use client";

import { useRef, useState, useTransition } from "react";
import { uploadListingImage, listingImageUrl } from "@/lib/storage";
import { addListingImage, deleteListingImage } from "./image-actions";

type ListingImage = { id: string; storage_path: string };

export default function ImageManager({
  sellerId,
  listingId,
  images,
}: {
  sellerId: string;
  listingId: string;
  images: ListingImage[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setIsUploading(true);

    try {
      const path = await uploadListingImage(sellerId, listingId, file);
      await addListingImage(listingId, path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع الصورة");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm">الصور ({images.length}/8)</span>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listingImageUrl(image.storage_path)}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(() =>
                    deleteListingImage(listingId, image.id, image.storage_path)
                  )
                }
                className="absolute top-1 left-1 bg-black/60 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < 8 && (
        <label className="text-sm text-black/60 dark:text-white/60 cursor-pointer">
          {isUploading ? "جارٍ الرفع..." : "+ إضافة صورة"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
