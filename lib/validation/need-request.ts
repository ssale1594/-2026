import { z } from "zod";

export const needRequestSchema = z.object({
  title: z.string().trim().min(5, "اكتب طلبك بوضوح أكثر").max(120, "العنوان طويل"),
  description: z.string().trim().max(1000, "الوصف طويل").optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  neighborhoodId: z.coerce.number().int().positive().optional(),
  // Same Saudi-mobile normalization as the seller signup form, so both tables
  // store numbers in one consistent wa.me-ready shape.
  contactWhatsapp: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(
      (digits) => /^(9665\d{8}|05\d{8}|5\d{8})$/.test(digits),
      "رقم واتساب غير صحيح"
    )
    .transform((digits) =>
      digits.startsWith("966") ? digits : `966${digits.replace(/^0/, "")}`
    ),
});

export const needResponseSchema = z.object({
  message: z.string().trim().min(5, "اكتب ردًا أوضح").max(600, "الرد طويل"),
});

export type NeedRequestInput = z.infer<typeof needRequestSchema>;
