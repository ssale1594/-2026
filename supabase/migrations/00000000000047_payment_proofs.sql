-- ============================================================
-- إيصالات الدفع والتحويل البنكي عبر Supabase Storage
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- قراءة إيصالات الدفع: فقط طرفي الصفقة + الأدمن
drop policy if exists "payment_proofs parties read" on storage.objects;
create policy "payment_proofs parties read" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (
      -- {deal_id}/{buyer_id|seller_id}/{...}  —  أولاً نسمح للـ service_role بالوصول إذا ما استدعيته
      -- لكن ك authenticated (جلسة المستخدم) نتحقق عبر الاستعلام:
      exists (
        select 1 from deals d
        where  d.id::text = (storage.foldername(name))[1]
          and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
      )
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

drop policy if exists "payment_proofs buyer/seller upload their own proof" on storage.objects;
create policy "payment_proofs buyer/seller upload their own proof" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from deals d
      where d.id::text = (storage.foldername(name))[1]
        and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
        and d.status in ('pending', 'accepted', 'buyer_confirmed')
    )
  );

drop policy if exists "payment_proofs owner delete" on storage.objects;
create policy "payment_proofs owner delete" on storage.objects
  for delete using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create table if not exists deal_payments (
  id bigserial primary key,
  deal_id bigint not null references deals(id) on delete cascade,
  submitted_by uuid not null references profiles(id) on delete cascade,
  paid_by_buyer boolean not null default false,
  payment_method text not null check (payment_method in ('bank_transfer','stc_pay','cash_on_delivery','other')),
  amount_sar numeric(12,2) not null check (amount_sar > 0),
  reference_number text,
  bank_name text,
  transfer_date date,
  payer_account_last4 text,
  proof_storage_path text,
  proof_mime_type text,
  proof_filename text,
  proof_size_bytes bigint,
  notes text,
  verified_at timestamptz,
  verified_by uuid references profiles(id) on delete set null,
  verification_notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'verified', 'rejected', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_by_buyer = true or (paid_by_buyer = false and true))
);

create index if not exists deal_payments_deal_idx on deal_payments(deal_id, created_at desc);
create index if not exists deal_payments_user_idx on deal_payments(submitted_by, created_at desc);
create index if not exists deal_payments_status_idx on deal_payments(status) where status <> 'verified';

alter table deal_payments enable row level security;

drop policy if exists "deal_payments parties read" on deal_payments;
create policy "deal_payments parties read"
  on deal_payments for select using (
    submitted_by = auth.uid() or
    exists (
      select 1 from deals d
      where d.id = deal_id and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
    )
  );

drop policy if exists "deal_payments party insert" on deal_payments;
create policy "deal_payments party insert"
  on deal_payments for insert with check (
    submitted_by = auth.uid() and
    status = 'submitted' and
    verified_at is null and
    verified_by is null and
    exists (
      select 1 from deals d
      where d.id = deal_id
        and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
        and d.status in ('pending', 'accepted', 'buyer_confirmed')
    )
  );

drop policy if exists "deal_payments uploader can cancel or edit notes" on deal_payments;
create policy "deal_payments uploader can cancel or edit notes"
  on deal_payments for update using (
    submitted_by = auth.uid()
  ) with check (
    submitted_by = auth.uid()
    and status in ('submitted', 'cancelled')
    and (
      (old.status = 'submitted' and new.status in ('submitted', 'cancelled'))
      or (old.status = 'cancelled' and new.status = 'cancelled')
    )
    and old.amount_sar = new.amount_sar
    and old.payment_method = new.payment_method
    and old.reference_number is not distinct from new.reference_number
    and old.deal_id = new.deal_id
    and old.submitted_by = new.submitted_by
  );

drop policy if exists "deal_payments admin verify" on deal_payments;
create policy "deal_payments admin verify"
  on deal_payments for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select, insert, update on deal_payments to authenticated;

-- Trigger: set updated_at
create or replace function deal_payments_set_ts() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists deal_payments_ts_trigger on deal_payments;
create trigger deal_payments_ts_trigger before update on deal_payments
  for each row execute function deal_payments_set_ts();

-- Trigger: عند إدخال دفع جديد، إرسال إشعار للطرف الآخر
create or replace function deal_payments_notify() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  other_party uuid;
  link_path text;
  am_buyer boolean;
begin
  if tg_op <> 'INSERT' then return new; end if;
  select (case when new.submitted_by = d.buyer_id then d.seller_id else d.buyer_id end),
         (new.submitted_by = d.buyer_id)
  into other_party, am_buyer
  from deals d where d.id = new.deal_id;

  link_path := am_buyer ? '/dashboard/deals' : '/my/deals';

  begin
    perform notify(
      other_party,
      'payment_received',
      'إيصال دفع جديد مرفوع',
      format('%s رفع إيصال بقيمة %s ر.س على الصفقة #%s',
        case when am_buyer then 'المشتري' else 'البائع' end,
        to_char(new.amount_sar, 'FM999G999G999'),
        new.deal_id),
      link_path || '?focus=' || new.deal_id::text
    );
  exception when others then null;
  end;
  return new;
end; $$;

drop trigger if exists deal_payments_notify_trigger on deal_payments;
create trigger deal_payments_notify_trigger after insert on deal_payments
  for each row execute function deal_payments_notify();
