-- ============================================================
-- إغلاق حلقة "رشّح مشروعًا" — كانت بلا متابعة إطلاقًا
-- ============================================================
--
-- referrals (migration 18) يسجّل ترشيحًا عامًا (اسم + واتساب لمحل لسه ما
-- انضم)، لكن ما فيه أي ربط بين هذا الترشيح والبائع الفعلي لو انضم لاحقًا —
-- الأدمن يضل يشوفه "pending" للأبد حتى لو المحل سجّل بنفسه بعدها بيوم.
--
-- الحل: عند إنشاء أي حساب بائع جديد، نطابق رقم واتساب المحل مع الترشيحات
-- المعلّقة (نفس آخر 9 أرقام — يتفادى فروقات صيغة 05xxxxxxxx مقابل
-- 9665xxxxxxxx)، ولو تطابق نحدّث الترشيح لـ"contacted" تلقائيًا بملاحظة توضّح
-- إنه انضم من نفسه، بدل ما يبقى بقائمة الأدمن كطلب متابعة وهمي.

create or replace function link_referral_on_signup(p_seller_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_whatsapp text;
  v_matched_id bigint;
begin
  select whatsapp_number into v_whatsapp from sellers where id = p_seller_id;
  if v_whatsapp is null then return; end if;

  select id into v_matched_id
    from referrals
   where status = 'pending'
     and business_whatsapp is not null
     and right(regexp_replace(business_whatsapp, '\D', '', 'g'), 9)
       = right(regexp_replace(v_whatsapp, '\D', '', 'g'), 9)
   limit 1;

  -- admin_actions.admin_id is a real admin actor by design (migration 3) —
  -- this event has no admin behind it, so it belongs on the referral row
  -- itself, not that log.
  if v_matched_id is not null then
    update referrals
       set status = 'contacted',
           business_description = coalesce(business_description || e'\n\n', '')
             || '✅ انضم البائع بنفسه (تطابق تلقائي برقم واتساب) — ما يحتاج متابعة.'
     where id = v_matched_id;
  end if;
end $$;

grant execute on function link_referral_on_signup(uuid) to authenticated;
