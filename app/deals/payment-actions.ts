"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const ProofSchema = z.object({
  dealId: z.coerce.number().int().positive(),
  storagePath: z.string().trim().min(3, "رابط الملف غير صالح"),
  proofMime: z.string().trim().min(3),
  proofFilename: z.string().trim().min(1),
  proofSizeBytes: z.coerce.number().int().nonnegative(),
  paymentMethod: z.enum(["bank_transfer", "stc_pay", "cash_on_delivery", "other"]),
  amount: z.coerce.number().positive(),
  referenceNumber: z.string().trim().max(120, "الرقم المرجعي طويل جداً").optional().or(z.literal("")),
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  transferDateIso: z.string().min(6, "حدّد تاريخ التحويل").or(z.string().length(0)),
  payerAccountLast4: z.string().trim().max(8).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function submitPaymentProof(raw: unknown) {
  const user = await requireUser();
  const supabase = await createClient();
  const p = ProofSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const v = p.data;

  // التأكد من أن المستخدم طرف في الصفقة وحالة الصفقة تسمح برفع الإيصال
  const dq = await supabase
    .from("deals")
    .select("id, buyer_id, seller_id, price_agreed_sar, status")
    .eq("id", v.dealId)
    .single();
  if (dq.error) return { error: "الصفقة غير موجودة" };
  const d = dq.data as any;
  if (d.buyer_id !== user.id && d.seller_id !== user.id)
    return { error: "ليست صفقتك" };
  if (!["pending", "accepted", "buyer_confirmed"].includes(d.status))
    return { error: "حالة الصفقة لا تسمح برفع إيصال دفع حالياً." };

  const pathParts = v.storagePath.split("/");
  if (pathParts.length < 3) return { error: "مسار الملف غير مقبول" };
  if (pathParts[0] !== String(v.dealId)) return { error: "الملف لا ينتمي لهذه الصفقة" };
  if (pathParts[1] !== user.id) return { error: "الملف غير مرافق لحسابك" };

  const insert = await supabase.from("deal_payments").insert({
    deal_id: v.dealId,
    submitted_by: user.id,
    paid_by_buyer: d.buyer_id === user.id,
    payment_method: v.paymentMethod,
    amount_sar: v.amount,
    reference_number: v.referenceNumber || null,
    bank_name: v.bankName || null,
    transfer_date: v.transferDateIso ? new Date(v.transferDateIso).toISOString().slice(0, 10) : null,
    payer_account_last4: v.payerAccountLast4 || null,
    proof_storage_path: v.storagePath,
    proof_mime_type: v.proofMime,
    proof_filename: v.proofFilename,
    proof_size_bytes: v.proofSizeBytes,
    notes: v.notes || null,
    status: "submitted",
  });
  if (insert.error) return { error: insert.error.message };

  revalidatePath(`/my/deals`);
  revalidatePath(`/dashboard/deals`);
  revalidatePath(`/my/deals/${v.dealId}`);
  return { ok: true };
}

export async function cancelPayment(proofId: number) {
  const user = await requireUser();
  const supabase = await createClient();
  const q = await supabase
    .from("deal_payments")
    .select("id, submitted_by, status, proof_storage_path")
    .eq("id", proofId)
    .single();
  if (q.error) return { error: "الدفع غير موجود" };
  const rec = q.data as any;
  if (rec.submitted_by !== user.id) return { error: "ليس دفعاً لك" };
  if (!["submitted", "cancelled"].includes(rec.status)) return { error: "لا يمكن الإلغاء" };

  const upd = await supabase
    .from("deal_payments")
    .update({ status: "cancelled" })
    .eq("id", proofId);
  if (upd.error) return { error: upd.error.message };

  // احذف الملف من storage أيضاً
  if (rec.proof_storage_path) {
    try {
      await supabase.storage.from("payment-proofs").remove([rec.proof_storage_path]);
    } catch {
      /* ignore */
    }
  }

  revalidatePath(`/my/deals`);
  revalidatePath(`/dashboard/deals`);
  return { ok: true };
}

// دالة لعمل Signed URL للإيصال الخاص (لا يُعرض public؛ لذلك نُصدّر URL بمهلة من Server Action)
export async function createPaymentProofSignedUrl(storagePath: string, expirySeconds = 60 * 60) {
  const user = await requireUser();
  const supabase = await createClient();

  // التحقق أن المستخدم طرف في الصفقة المرتبطة بالدفع
  const dealId = storagePath.split("/")[0];
  const dq = await supabase
    .from("deals")
    .select("buyer_id, seller_id")
    .eq("id", Number(dealId))
    .single();
  if (dq.error) return { error: "الدفع غير موجود" };
  const d = dq.data as any;
  if (d.buyer_id !== user.id && d.seller_id !== user.id)
    return { error: "ليس لكم صلاحية رؤية هذا المرفق" };

  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(storagePath, expirySeconds);
  if (error || !data) return { error: (error?.message) ?? "تعذّر إنشاء رابط المعاينة" };
  return { ok: true, signedUrl: data.signedUrl };
}
