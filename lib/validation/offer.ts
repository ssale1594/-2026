import { z } from "zod";

export const offerInputSchema = z
  .object({
    title: z.string().trim().min(3, "عنوان العرض قصير جدًا").max(120, "العنوان طويل"),
    description: z.string().trim().max(500, "الوصف طويل").optional(),
    listingId: z.string().uuid().optional().or(z.literal("")),
    startsAt: z.string().min(1, "حدد تاريخ البداية"),
    endsAt: z.string().min(1, "حدد تاريخ النهاية"),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "تاريخ النهاية لازم يكون بعد البداية",
  });

export type OfferInput = z.infer<typeof offerInputSchema>;
