import { z } from "zod";

export const questionInputSchema = z.object({
  title: z.string().trim().min(8, "اكتب سؤالك بوضوح أكثر").max(150, "السؤال طويل"),
  body: z.string().trim().max(1000, "التفاصيل طويلة").optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  neighborhoodId: z.coerce.number().int().positive().optional(),
});

export const answerInputSchema = z.object({
  body: z.string().trim().min(3, "اكتب ردًا أوضح").max(1000, "الرد طويل"),
  recommendedSellerId: z.string().uuid().optional().or(z.literal("")),
});
