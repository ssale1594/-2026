-- ============================================================
-- نظام الصفقات والتعاقد بين البائع والعميل + شارة المعاملات
-- ============================================================

create table if not exists deals (
  id bigserial primary key,
  listing_id uuid references listings(id) on delete set null,
  seller_id uuid not null references sellers(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  title text,
  description text,
  price_agreed_sar numeric(12, 2),
  status text not null default 'pending'
    check (status in (
      'pending',       -- انتظار موافقة البائع
      'rejected',      -- رفض البائع
      'accepted',      -- قبلها البائع (جاري التنفيذ)
      'buyer_confirmed', -- العميل أكد الاستلام
      'completed',     -- (اختياري) البائع أكمل الأوراق والدفع - النهائي
      'disputed',      -- خصومة - تحتاج تدخل إدارة
      'cancelled'      -- ألغى أحد الطرفين
    )),
  rejected_reason text,
  dispute_reason text,
  cancelled_by uuid references profiles(id) on delete set null,
  cancelled_reason text,
  accepted_at timestamptz,
  completed_at timestamptz,
  disputed_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  delivery_notes text,
  deadline_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_seller_idx on deals(seller_id, status, created_at desc);
create index if not exists deals_buyer_idx on deals(buyer_id, status, created_at desc);
create index if not exists deals_listing_idx on deals(listing_id);
create index if not exists deals_status_idx on deals(status);

alter table deals enable row level security;

drop policy if exists "parties see their own deals" on deals;
create policy "parties see their own deals"
  on deals for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "buyer creates deal" on deals;
create policy "buyer creates deal"
  on deals for insert with check (
    auth.uid() = buyer_id and
    status = 'pending' and
    exists (
      select 1 from listings l
      where l.id = listing_id and l.status = 'published'
    )
  );

-- سياسة واحدة تسمح لطرفي الصفقة بالتحديث. تحويلات الحالة المسموحة يفرضها
-- المشغّل أدناه لا السياسة: تعبير WITH CHECK ما يرى الصف قبل التعديل —
-- old/new صياغة مشغّلات لا سياسات، وكتابتها هنا خطأ صياغي يُفشل الهجرة.
drop policy if exists "seller updates deal status" on deals;
drop policy if exists "buyer updates deal status (confirm/cancel)" on deals;
drop policy if exists "deal parties update" on deals;
create policy "deal parties update"
  on deals for update
  using (auth.uid() = seller_id or auth.uid() = buyer_id)
  with check (auth.uid() = seller_id or auth.uid() = buyer_id);

-- الأعمدة التي لا يجوز إعادة كتابتها بعد الإنشاء — حجب على مستوى العمود،
-- لأن WITH CHECK لا يقدر يثبّت عمودًا على قيمته السابقة. السحب على مستوى
-- الجدول أولاً إلزامي: حجب عمود مع بقاء منح الجدول لا أثر له في Postgres.
revoke update on deals from authenticated;
grant update (
  title, description, status, rejected_reason, dispute_reason, cancelled_by,
  cancelled_reason, delivery_notes, deadline_date, updated_at
) on deals to authenticated;
-- scheduled_at يُضاف في الهجرة 51 ويُمنَح ضمنها؛ ذكره هنا يفشل لأنه
-- ما زال غير موجود عند هذه النقطة.

-- ============================================================
-- تحويلات حالة الصفقة المسموحة
-- ============================================================
create or replace function deals_status_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.status is not distinct from old.status then return new; end if;

  -- المشغّلات والإدارة تمرّ بلا قيد (auth.uid() فارغ في سياق الخدمة)
  if v_uid is null or is_admin() then return new; end if;

  if v_uid = old.seller_id then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'rejected')) or
      (old.status = 'accepted' and new.status = 'completed') or
      (old.status = 'buyer_confirmed' and new.status in ('completed', 'disputed'))
    ) then
      raise exception 'تحويل حالة غير مسموح للبائع: % → %', old.status, new.status;
    end if;
  elsif v_uid = old.buyer_id then
    if not (
      (old.status in ('pending', 'accepted') and new.status = 'cancelled') or
      (old.status = 'accepted' and new.status in ('buyer_confirmed', 'disputed')) or
      (old.status = 'buyer_confirmed' and new.status = 'disputed')
    ) then
      raise exception 'تحويل حالة غير مسموح للمشتري: % → %', old.status, new.status;
    end if;
  else
    raise exception 'لست طرفًا في هذه الصفقة';
  end if;

  return new;
end; $$;

drop trigger if exists deals_status_guard_trigger on deals;
create trigger deals_status_guard_trigger before update on deals
  for each row execute function deals_status_guard();

-- دالة: عدد صفقات البائع الناجحة المكتملة (للشارة)
create or replace function seller_completed_deals(p_seller_id uuid)
returns table (
  completed_count bigint,
  total_revenue_sar numeric,
  in_progress_count bigint,
  disputed_count bigint,
  last30d_completed bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('completed', 'buyer_confirmed')), 0)::bigint as completed_count,
    coalesce((select sum(d.price_agreed_sar) from deals d where d.seller_id = p_seller_id and d.status in ('completed', 'buyer_confirmed')), 0)::numeric as total_revenue_sar,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('accepted', 'pending')), 0)::bigint as in_progress_count,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status = 'disputed'), 0)::bigint as disputed_count,
    coalesce((select count(*) from deals d where d.seller_id = p_seller_id and d.status in ('completed', 'buyer_confirmed') and d.updated_at > now() - interval '30 days'), 0)::bigint as last30d_completed;
end; $$;
grant execute on function seller_completed_deals(uuid) to anon, authenticated;

-- Trigger: تحديث updated_at
create or replace function deals_set_updated() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'accepted' and old.status <> 'accepted' then new.accepted_at = now(); end if;
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at = now(); end if;
  if new.status = 'disputed' and old.status <> 'disputed' then new.disputed_at = now(); end if;
  if new.status = 'rejected' and old.status <> 'rejected' then new.rejected_at = now(); end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then new.cancelled_at = now(); end if;
  return new;
end; $$;

drop trigger if exists deals_update_trigger on deals;
create trigger deals_update_trigger before update on deals
  for each row execute function deals_set_updated();
