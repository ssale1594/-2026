"use client";

import { useActionState } from "react";
import { updateListing, type EditFormState } from "./actions";

const initialState: EditFormState = {};

const fieldClass =
  "rounded-lg border border-black/[.12] dark:border-white/[.2] bg-transparent px-3 py-2 text-sm w-full";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  category_id: number;
  price: number | null;
  price_negotiable: boolean;
};

export default function EditListingForm({
  listing,
  categories,
}: {
  listing: Listing;
  categories: { id: number; name_ar: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    updateListing.bind(null, listing.id),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">عنوان الإعلان</span>
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={listing.title}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الفئة</span>
        <select
          name="categoryId"
          required
          defaultValue={listing.category_id}
          className={fieldClass}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_ar}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">الوصف</span>
        <textarea
          name="description"
          rows={5}
          maxLength={2000}
          defaultValue={listing.description ?? ""}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">السعر (ر.س) — اختياري</span>
        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          defaultValue={listing.price ?? ""}
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          name="priceNegotiable"
          type="checkbox"
          defaultChecked={listing.price_negotiable}
        />
        <span className="text-sm">السعر قابل للتفاوض</span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "جارٍ الحفظ..." : "حفظ وإرسال للمراجعة"}
      </button>
    </form>
  );
}
