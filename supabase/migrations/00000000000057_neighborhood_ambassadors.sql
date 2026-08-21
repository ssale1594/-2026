-- ============================================================
-- سفراء الأحياء (neighborhood ambassadors) — ROADMAP المرحلة 2 §6،
-- تكررت بـ4 مصادر مستقلة: Gemini§16.14, Grok§17.17, DeepSeek§19.25, Kimi§21.20.
-- ============================================================
--
-- الفكرة: شخص من الحي (بائع أو مشتري) يتطوّع يعرّف جيرانه بالمنصة، ومقابلها
-- يحصل على اعتراف علني (بادج على صفحة الحي) وامتياز بسيط (شرائح إعلانات
-- إضافية لو كان بائعًا) — بدون التزام رسمي أو راتب.
--
-- مقصود تصميمه فوق الجداول الموجودة لا بديلاً عنها: seller_referrals (migration
-- 31) يقيس "بائع جاب بائع"، وvouches (migration 25) يقيس "جار زكّى بائع". هذي
-- إشارات ثقة حقيقية موجودة أصلاً — سفير الحي هو الشخص اللي تراكمت عنده هذي
-- الإشارات بحي معيّن، فبدل جدول نقاط منفصل نحسبها من نفس المصدر.

-- log_admin_action() (migration 54) checks target_type against admin_actions'
-- check constraint — widen it for the new 'ambassador' action below.
alter table admin_actions drop constraint if exists admin_actions_target_type_check;
alter table admin_actions
  add constraint admin_actions_target_type_check
  check (target_type in ('seller', 'listing', 'offer', 'event', 'job',
                         'referral', 'question', 'answer', 'report',
                         'subscription', 'ambassador'));

create table if not exists neighborhood_ambassadors (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  neighborhood_id int references neighborhoods(id) on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'revoked')),
  note text,
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id) on delete set null,
  -- شخص واحد سفير لحي واحد بنفس الوقت (يقدر يقدّم لحي ثاني لو انسحب من الأول)
  unique (user_id, neighborhood_id)
);

create index if not exists ambassadors_neighborhood_idx
  on neighborhood_ambassadors (neighborhood_id) where status = 'approved';
create index if not exists ambassadors_pending_idx
  on neighborhood_ambassadors (status) where status = 'pending';

alter table neighborhood_ambassadors enable row level security;

drop policy if exists "user reads own ambassador applications" on neighborhood_ambassadors;
create policy "user reads own ambassador applications"
  on neighborhood_ambassadors for select using (user_id = auth.uid() or is_admin());

-- القراءة العامة لسفراء معتمدين فقط تتم عبر neighborhood_ambassadors_public()
-- أدناه لا عبر سياسة SELECT مباشرة، عشان ما نكشف أعمدة الطلب (note, user_id)
-- لغير صاحبه.

drop policy if exists "user applies as ambassador" on neighborhood_ambassadors;
create policy "user applies as ambassador"
  on neighborhood_ambassadors for insert with check (user_id = auth.uid());

revoke update on neighborhood_ambassadors from authenticated;

create or replace function apply_neighborhood_ambassador(p_neighborhood_id int, p_note text default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
begin
  if v_uid is null then raise exception 'يلزم تسجيل الدخول'; end if;
  if not exists (select 1 from neighborhoods where id = p_neighborhood_id) then
    raise exception 'الحي غير موجود';
  end if;

  insert into neighborhood_ambassadors (user_id, neighborhood_id, note)
  values (v_uid, p_neighborhood_id, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (user_id, neighborhood_id) do update
    set note = excluded.note,
        status = case when neighborhood_ambassadors.status = 'revoked' then 'pending'
                      else neighborhood_ambassadors.status end
  returning id into v_id;

  return v_id;
end $$;

grant execute on function apply_neighborhood_ambassador(int, text) to authenticated;

create or replace function admin_set_ambassador_status(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_seller_id uuid;
begin
  if not is_admin() then raise exception 'غير مصرح به'; end if;
  if p_status not in ('approved', 'revoked') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;

  update neighborhood_ambassadors
     set status = p_status, decided_at = now(), decided_by = auth.uid()
   where id = p_id
  returning user_id into v_seller_id;

  if not found then raise exception 'الطلب غير موجود'; end if;

  -- مكافأة بسيطة: لو السفير المعتمد بائع، +2 شريحة إعلان مجانية — نفس آلية
  -- referral_bonus_slots (migration 31)، بدون التزام مالي (مبدأ التكلفة).
  if p_status = 'approved' and exists (select 1 from sellers where id = v_seller_id) then
    update sellers set referral_bonus_slots = referral_bonus_slots + 2 where id = v_seller_id;
  end if;

  perform log_admin_action('ambassador_' || p_status, 'ambassador', p_id::text, null);
end $$;

grant execute on function admin_set_ambassador_status(bigint, text) to authenticated;

-- القائمة العامة لسفراء حي معيّن — تُستخدم بصفحة /neighborhood/[slug].
-- تكشف الاسم والصورة فقط، لا ملاحظة الطلب ولا معرّف المستخدم الخام.
create or replace function neighborhood_ambassadors_public(p_neighborhood_id int)
returns table (display_name text, is_seller boolean, seller_slug text)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    coalesce(s.business_name, p.full_name, 'عضو من الحي')::text as display_name,
    (s.id is not null) as is_seller,
    s.slug as seller_slug
  from neighborhood_ambassadors a
  join profiles p on p.id = a.user_id
  left join sellers s on s.id = a.user_id and s.verification_status = 'approved'
  where a.neighborhood_id = p_neighborhood_id and a.status = 'approved'
  order by a.decided_at asc nulls last;
$$;

grant execute on function neighborhood_ambassadors_public(int) to anon, authenticated;

-- طلب المستخدم الحالي، لعرض حالته بصفحة التقديم (pending/approved/revoked/none).
create or replace function my_ambassador_applications()
returns table (neighborhood_id int, neighborhood_name text, status text, applied_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.neighborhood_id, n.name_ar, a.status, a.applied_at
    from neighborhood_ambassadors a
    join neighborhoods n on n.id = a.neighborhood_id
   where a.user_id = auth.uid()
   order by a.applied_at desc;
$$;

grant execute on function my_ambassador_applications() to authenticated;
