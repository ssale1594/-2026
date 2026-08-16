-- "رشّح مشروعًا" (refer-a-business) — anonymous public submissions of a shop/
-- home-producer someone knows but hasn't signed up itself. ROADMAP.md phase 2:
-- most home producers won't discover the platform on their own, so the
-- community needs a channel to bring them in.

create table referrals (
  id bigserial primary key,
  referrer_name text,
  business_name text not null,
  business_description text,
  business_whatsapp text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'dismissed')),
  created_at timestamptz default now()
);

alter table referrals enable row level security;

-- Migration 15 narrowed the default privileges for new tables to SELECT-only for
-- anon, so an RLS insert policy alone is not enough — anonymous visitors need an
-- explicit table-level INSERT grant or every submission fails with "permission
-- denied" before RLS is even consulted.
grant insert on referrals to anon;

-- Anyone (including anonymous visitors) can submit a referral; no read access
-- outside admin — same "insert-only from clients" shape as contact_clicks.
create policy "referrals_insert_public" on referrals for insert with check (true);

create policy "admin_all_referrals" on referrals for all using (
  is_admin()
);

-- admin_actions.target_id was uuid-only (fits seller/listing ids) and its check
-- constraint didn't know about this new target type — referrals.id is bigint,
-- so widen the column to text (works for both) and allow 'referral'.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'admin_actions' and column_name = 'target_id' and data_type = 'uuid'
  ) then
    alter table admin_actions alter column target_id type text using target_id::text;
  end if;

  if exists (select 1 from pg_constraint where conname = 'admin_actions_target_type_check') then
    alter table admin_actions drop constraint admin_actions_target_type_check;
  end if;

  alter table admin_actions add constraint admin_actions_target_type_check
    check (target_type in ('seller', 'listing', 'referral'));
end $$;
