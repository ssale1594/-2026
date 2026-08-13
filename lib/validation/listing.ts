import { z } from "zod";

// TECH.md §12.6 — every mutation is validated server-side, never trusting the client.
export const listingInputSchema = z.object({
  title: z.string().trim().min(3, "العنوان قصير جدًا").max(120, "العنوان طويل"),
  description: z.string().trim().max(2000, "الوصف طويل").optional(),
  categoryId: z.coerce.number().int().positive("اختر الفئة"),
  price: z.coerce.number().nonnegative("السعر لا يكون سالبًا").optional(),
  priceNegotiable: z.coerce.boolean().default(false),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

export const sellerSetupSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "اسم النشاط قصير جدًا")
    .max(80, "اسم النشاط طويل"),
  businessType: z.enum([
    "shop",
    "home_producer",
    "service_provider",
    "real_estate_agent",
    "individual",
  ]),
  description: z.string().trim().max(1000, "الوصف طويل").optional(),
  // Saudi mobile in international form, digits only after normalization.
  whatsappNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(
      (digits) => /^(9665\d{8}|05\d{8}|5\d{8})$/.test(digits),
      "رقم واتساب غير صحيح"
    )
    .transform((digits) =>
      digits.startsWith("966")
        ? digits
        : `966${digits.replace(/^0/, "")}`
    ),
});

export type SellerSetupInput = z.infer<typeof sellerSetupSchema>;
