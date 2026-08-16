-- توصية الجار (neighbor vouching) — repeated across sources: Grok §17.7,
-- GLM §18.10 "الكفيل المجتمعي", DeepSeek §19.9 "شهادة الجيران الخمسة",
-- ChatGPT §20.20. In a town where everyone knows everyone, "150 من أهل بلدك
-- يعرفونه" is stronger social proof than any anonymous star average.
--
-- Deliberately separate from reviews: a review requires a confirmed
-- transaction, a vouch only requires knowing the person. They answer different
-- questions ("is he good at the job?" vs "is he a real, known person?").

create table if not exists vouches (
  id bigserial primary key,
  seller_id uuid references sellers(id) on delete cascade not null,
  voucher_id uuid references profiles(id) on delete cascade not null,
  note text,
  created_at timestamptz default now(),
  -- One vouch per person per seller, and never for yourself.
  unique (seller_id, voucher_id),
  constraint vouches_no_self check (seller_id <> voucher_id)
);

create index if not exists idx_vouches_seller on vouches (seller_id);

alter table vouches enable row level security;

-- Vouches are public — the count is the whole point.
drop policy if exists "vouches_select_public" on vouches;
create policy "vouches_select_public" on vouches for select using (true);

-- A signed-in resident vouches as themselves, only for an approved seller.
-- The self-vouch block lives in the CHECK constraint above as well, so it holds
-- even for an admin-issued insert.
drop policy if exists "vouches_insert_own" on vouches;
create policy "vouches_insert_own" on vouches for insert with check (
  voucher_id = auth.uid()
  and exists (
    select 1 from sellers s
    where s.id = seller_id and s.verification_status = 'approved'
  )
);

drop policy if exists "vouches_delete_own" on vouches;
create policy "vouches_delete_own" on vouches for delete using (
  voucher_id = auth.uid()
);

drop policy if exists "admin_all_vouches" on vouches;
create policy "admin_all_vouches" on vouches for all using (is_admin());

create or replace function seller_vouch_count(p_seller_id uuid)
returns bigint as $$
  select count(*) from vouches where seller_id = p_seller_id;
$$ language sql stable security definer set search_path = public, pg_temp;
