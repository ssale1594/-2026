import { z } from "zod";

export const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1, "اختر تقييم").max(5, "التقييم من 1 لـ5"),
  comment: z.string().trim().max(600, "التعليق طويل").optional(),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;
