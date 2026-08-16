import { z } from "zod";

export const sponsorshipInputSchema = z
  .object({
    sponsorName: z.string().trim().min(2, "اسم الراعي قصير جدًا").max(80, "اسم الراعي طويل"),
    sponsorUrl: z.string().trim().url("رابط غير صحيح").max(300).optional().or(z.literal("")),
    message: z.string().trim().max(120, "الرسالة طويلة").optional(),
    targetType: z.enum(["home", "category", "journey"]),
    targetId: z.coerce.number().int().positive().optional(),
    startsAt: z.string().min(1, "حدد تاريخ البداية"),
    endsAt: z.string().min(1, "حدد تاريخ النهاية"),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "تاريخ النهاية لازم يكون بعد البداية",
  })
  .refine(
    (data) => data.targetType === "home" || data.targetId !== undefined,
    { message: "اختر القسم أو الرحلة المرعية" }
  );

export type SponsorshipInput = z.infer<typeof sponsorshipInputSchema>;
