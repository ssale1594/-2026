import { z } from "zod";

export const referralInputSchema = z.object({
  referrerName: z.string().trim().max(80).optional(),
  businessName: z.string().trim().min(2, "اسم النشاط قصير جدًا").max(120, "اسم النشاط طويل"),
  businessDescription: z.string().trim().max(500, "الوصف طويل").optional(),
  businessWhatsapp: z.string().trim().max(20, "رقم طويل جدًا").optional(),
});

export type ReferralInput = z.infer<typeof referralInputSchema>;
