-- عروض اليوم (time-limited offers) — PLAN.md §2.8 and §1.2. A seller announces
-- a discount or limited deal that expires on its own, which is what makes it
-- worth checking the site daily. Distinct from is_featured (a permanent admin
-- flag): an offer carries its own window and its own copy.
--
-- Offers go through the same manual review as listings — an unreviewed
-- discount claim on the front page is exactly the kind of thing that damages
-- trust in a small town.

create table if not exists offers (
  id bigserial primary key,
  seller_id uuid references sellers(id) on delete cascade not null,
  -- Optional: an offer may point at one listing, or stand alone (e.g. a
  -- shop-wide "خصم 20% هذا الأسبوع").
  listing_id uuid references listings(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected')),
  created_at timestamptz default now(),
  constraint offers_period_valid check (ends_at > starts_at)
);

create index if not exists idx_offers_live
  on offers (status, starts_at, ends_at);
create index if not exists idx_offers_seller on offers (seller_id, created_at desc);

alter table offers enable row level security;

-- Public sees only reviewed offers inside their window. Expiry is enforced in
-- the policy itself rather than by a cleanup job, so a lapsed offer disappears
-- the moment it ends with nothing scheduled to run.
drop policy if exists "offers_select_public" on offers;
create policy "offers_select_public" on offers for select using (
  status = 'published' and now() >= starts_at and now() < ends_at
);

drop policy if exists "offers_select_own" on offers;
create policy "offers_select_own" on offers for select using (
  seller_id = auth.uid()
);

-- Only an approved seller may create offers, and never pre-published.
drop policy if exists "offers_insert_own" on offers;
create policy "offers_insert_own" on offers for insert with check (
  seller_id = auth.uid()
  and status = 'pending_review'
  and exists (
    select 1 from sellers s
    where s.id = auth.uid() and s.verification_status = 'approved'
  )
);

-- status is admin-only territory: revoking the column stops a seller from
-- publishing their own offer through a direct API call, the same way
-- migration 15 handled listings.is_featured.
revoke update (status, seller_id) on offers from authenticated;

drop policy if exists "offers_update_own" on offers;
create policy "offers_update_own" on offers for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "offers_delete_own" on offers;
create policy "offers_delete_own" on offers for delete using (
  seller_id = auth.uid()
);

drop policy if exists "admin_all_offers" on offers;
create policy "admin_all_offers" on offers for all using (is_admin());

-- admin_actions logs offer reviews too; migration 18 widened target_id to text
-- and this extends the allowed target types alongside it.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'admin_actions_target_type_check') then
    alter table admin_actions drop constraint admin_actions_target_type_check;
  end if;

  alter table admin_actions add constraint admin_actions_target_type_check
    check (target_type in ('seller', 'listing', 'referral', 'offer'));
end $$;
