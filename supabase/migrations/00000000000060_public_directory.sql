-- ============================================================
-- الدليل العام للزلفي — PLAN.md §23 (حل مشكلة "البيضة والدجاجة")
-- ============================================================
--
-- الفكرة (من صاحب المشروع): بدل الاعتماد الكامل على تسجيل البائعين أنفسهم،
-- نبني دليل أوسع يشمل محلات وأماكن معروفة بالزلفي حتى لو أصحابها ما سجّلوا
-- بعد — يعطي الموقع محتوى مفيد من اليوم الأول بدل انتظار كل بائع يسجّل بنفسه،
-- وبعدين "يدعو" صاحب المحل يتبنّى (Claim) ملفه ويرقّيه لحساب بائع كامل.
--
-- تصميم متعمّد يحترم تحذير §23 نفسه ("لا تضيف رقم محل بدون إذن، وتأكد
-- المعلومة من مصدر عام أصلاً زي خرائط قوقل"): الإضافة **أدمن فقط** (يقرّر هو
-- مصدر كل صف)، لا إدخال عام مباشر. أي شخص من الجمهور يقدر "يقترح" إضافة
-- فقط (تصير قيد المراجعة، لا تُنشر تلقائيًا) — نفس نمط referrals.
--
-- التقييمات العامة على أماكن غير مسجّلة (§23.2) أُجّلت عمدًا لهذي الهجرة:
-- تقييم بلا حساب هو أول شي يُستهدف بالسبام/التقييمات المزيّفة، ويحتاج تصميم
-- حماية (rate limit + تحقق) منفصل — راجع IDEAS.md.

create table if not exists directory_entries (
  id bigserial primary key,
  business_name text not null,
  category_id int references categories(id),
  neighborhood_id int references neighborhoods(id),
  phone text,
  whatsapp_number text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  address_note text,
  -- من وين جاءت المعلومة — إلزامي، يوثّق أن المصدر عام لا خاص (خرائط قوقل،
  -- معرفة شخصية بالمكان...) بدل إخفاء المصدر.
  source_note text not null,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  claimed_by_seller_id uuid references sellers(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint directory_coords_valid check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create index if not exists directory_published_idx
  on directory_entries (status, neighborhood_id) where status = 'published';
create index if not exists directory_unclaimed_idx
  on directory_entries (status) where claimed_by_seller_id is null and status = 'published';

create trigger trg_directory_entries_updated_at before update on directory_entries
  for each row execute function set_updated_at();

alter table directory_entries enable row level security;

-- القراءة العامة تمر عبر public_directory() أدناه لا سياسة SELECT مباشرة،
-- عشان نتحكم بترتيب/فلترة الجدول بمكان واحد ونتجنّب N+1 مع الفئة والحي.
drop policy if exists "admin manages directory" on directory_entries;
create policy "admin manages directory" on directory_entries for all using (is_admin());

create or replace function admin_upsert_directory_entry(
  p_id bigint,
  p_business_name text,
  p_category_id int,
  p_neighborhood_id int,
  p_phone text,
  p_whatsapp text,
  p_latitude numeric,
  p_longitude numeric,
  p_address_note text,
  p_source_note text,
  p_status text
) returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id bigint;
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if coalesce(trim(p_business_name), '') = '' then raise exception 'اسم المحل مطلوب'; end if;
  if coalesce(trim(p_source_note), '') = '' then raise exception 'مصدر المعلومة مطلوب'; end if;
  if p_status not in ('published', 'hidden') then raise exception 'حالة غير صالحة'; end if;

  if p_id is null then
    insert into directory_entries (
      business_name, category_id, neighborhood_id, phone, whatsapp_number,
      latitude, longitude, address_note, source_note, status, created_by
    ) values (
      trim(p_business_name), p_category_id, p_neighborhood_id, p_phone, p_whatsapp,
      p_latitude, p_longitude, p_address_note, trim(p_source_note), p_status, auth.uid()
    ) returning id into v_id;
  else
    update directory_entries set
      business_name = trim(p_business_name),
      category_id = p_category_id,
      neighborhood_id = p_neighborhood_id,
      phone = p_phone,
      whatsapp_number = p_whatsapp,
      latitude = p_latitude,
      longitude = p_longitude,
      address_note = p_address_note,
      source_note = trim(p_source_note),
      status = p_status
    where id = p_id
    returning id into v_id;

    if v_id is null then raise exception 'السجل غير موجود'; end if;
  end if;

  return v_id;
end $$;

grant execute on function admin_upsert_directory_entry(
  bigint, text, int, int, text, text, numeric, numeric, text, text, text
) to authenticated;

-- الدليل العام — يجمع بائعين مسجّلين معتمدين + قيود الدليل العام غير
-- المُتبنّاة بقائمة واحدة، عشان صفحة /map تعرضهم معًا بمصدر بيانات واحد.
-- is_registered=false تعني "معلومات عامة، صاحبها ما سجّل بعد".
create or replace function public_directory(p_neighborhood_id int default null)
returns table (
  source text, id text, business_name text, slug text, category_name text,
  neighborhood_id int, neighborhood_name text, phone text, whatsapp_number text,
  latitude numeric, longitude numeric, address_note text, is_registered boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select 'directory', d.id::text, d.business_name, null::text, c.name_ar,
         d.neighborhood_id, n.name_ar, d.phone, d.whatsapp_number,
         d.latitude, d.longitude, d.address_note, false
    from directory_entries d
    left join categories c on c.id = d.category_id
    left join neighborhoods n on n.id = d.neighborhood_id
   where d.status = 'published'
     and d.claimed_by_seller_id is null
     and (p_neighborhood_id is null or d.neighborhood_id = p_neighborhood_id)
  union all
  select 'seller', s.id::text, s.business_name, s.slug, null::text,
         s.neighborhood_id, n.name_ar, s.phone, s.whatsapp_number,
         s.latitude, s.longitude, s.address_note, true
    from sellers s
    left join neighborhoods n on n.id = s.neighborhood_id
   where s.verification_status = 'approved'
     and (p_neighborhood_id is null or s.neighborhood_id = p_neighborhood_id);
$$;

grant execute on function public_directory(int) to anon, authenticated;

-- ============================================================
-- طلبات تبنّي محل (Claim)
-- ============================================================

create table if not exists directory_claims (
  id bigserial primary key,
  directory_entry_id bigint references directory_entries(id) on delete cascade not null,
  claimant_user_id uuid references profiles(id) on delete set null,
  claimant_whatsapp text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists directory_claims_pending_idx
  on directory_claims (status) where status = 'pending';

alter table directory_claims enable row level security;

drop policy if exists "admin reads directory claims" on directory_claims;
create policy "admin reads directory claims" on directory_claims for select using (is_admin());

drop policy if exists "user reads own directory claims" on directory_claims;
create policy "user reads own directory claims" on directory_claims for select using (
  claimant_user_id = auth.uid()
);

revoke all on directory_claims from anon, authenticated;

-- الإرسال يتم عبر الدالة (تعمل بدون تسجيل دخول أيضًا — صاحب المحل قد ما
-- يكون له حساب بعد، وهذي أول خطوة له بالمنصة).
create or replace function submit_directory_claim(
  p_directory_entry_id bigint, p_whatsapp text, p_note text default null
) returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id bigint;
begin
  if coalesce(trim(p_whatsapp), '') = '' then raise exception 'رقم واتساب مطلوب'; end if;
  if not exists (select 1 from directory_entries where id = p_directory_entry_id and status = 'published') then
    raise exception 'السجل غير موجود';
  end if;

  insert into directory_claims (directory_entry_id, claimant_user_id, claimant_whatsapp, note)
  values (p_directory_entry_id, auth.uid(), trim(p_whatsapp), nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  return v_id;
end $$;

grant execute on function submit_directory_claim(bigint, text, text) to anon, authenticated;

-- الأدمن يعتمد الطلب: يربط السجل بحساب بائع (لو موجود أصلًا) أو يتركه
-- للمتابعة اليدوية (تواصل واتساب لمساعدته يسجّل). ما نربط تلقائيًا بدون تحقق
-- الأدمن من هوية المتصل — رقم واتساب وحده مو كافي كإثبات ملكية محل.
create or replace function admin_decide_directory_claim(
  p_claim_id bigint, p_status text, p_seller_id uuid default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_entry_id bigint;
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'حالة غير صالحة'; end if;

  update directory_claims
     set status = p_status, decided_at = now()
   where id = p_claim_id
  returning directory_entry_id into v_entry_id;

  if not found then raise exception 'الطلب غير موجود'; end if;

  if p_status = 'approved' and p_seller_id is not null then
    update directory_entries
       set claimed_by_seller_id = p_seller_id
     where id = v_entry_id;
  end if;
end $$;

grant execute on function admin_decide_directory_claim(bigint, text, uuid) to authenticated;
