import { z } from "zod";

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(4, "عنوان الفعالية قصير جدًا").max(120, "العنوان طويل"),
    description: z.string().trim().max(1000, "الوصف طويل").optional(),
    locationText: z.string().trim().max(150, "الموقع طويل").optional(),
    neighborhoodId: z.coerce.number().int().positive().optional(),
    startsAt: z.string().min(1, "حدد وقت البداية"),
    endsAt: z.string().optional(),
  })
  .refine(
    (data) => !data.endsAt || new Date(data.endsAt) >= new Date(data.startsAt),
    { message: "وقت النهاية لازم يكون بعد البداية" }
  );

export const jobInputSchema = z.object({
  title: z.string().trim().min(4, "المسمى الوظيفي قصير جدًا").max(120, "العنوان طويل"),
  description: z.string().trim().max(1500, "الوصف طويل").optional(),
  jobType: z.enum(["full_time", "part_time", "temporary"]),
  salaryText: z.string().trim().max(80, "نص الراتب طويل").optional(),
  neighborhoodId: z.coerce.number().int().positive().optional(),
});

export const jobApplicationSchema = z.object({
  message: z.string().trim().max(600, "الرسالة طويلة").optional(),
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

export const savedSearchSchema = z.object({
  query: z.string().trim().min(2, "الكلمة قصيرة جدًا").max(80, "الكلمة طويلة"),
  categoryId: z.coerce.number().int().positive().optional(),
  neighborhoodId: z.coerce.number().int().positive().optional(),
});
