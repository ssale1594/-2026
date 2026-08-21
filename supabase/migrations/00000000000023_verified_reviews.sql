-- "تعاملت معه فعلاً" — verified transactions and reviews (PLAN.md §20.17,
-- §19.10, ROADMAP phase 2 item 3). The trust problem in a small town is not a
-- lack of star ratings; it is that anonymous stars mean nothing when everyone
-- knows everyone. So a review here must be attached to a transaction that the
-- *seller also confirmed* — both sides on the record.
--
-- Flow: buyer signs in and marks "تعاملت مع هذا البائع" on a listing → the
-- seller sees a pending claim and confirms or disputes it → only a confirmed
-- transaction unlocks the review form.
--
-- This is the first feature requiring buyers to have accounts. profiles already
-- exists for every auth.users row (migration 4) with role 'buyer' by default,
-- so no new identity system is needed — only these two tables on top.

create table if not exists transactions (
  id bigserial primary key,
  listing_id uuid references listings(id) on delete set null,
  seller_id uuid references sellers(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'claimed'
    check (status in ('claimed', 'confirmed', 'disputed')),
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  -- One open claim per buyer per listing; re-buying the same item repeatedly is
  -- not worth modelling yet and this blocks claim spam.
  unique (buyer_id, listing_id)
);

create index if not exists idx_transactions_seller on transactions (seller_id, status);
create index if not exists idx_transactions_buyer on transactions (buyer_id);

create table if not exists reviews (
  id bigserial primary key,
  transaction_id bigint references transactions(id) on delete cascade not null unique,
  seller_id uuid references sellers(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create index if not exists idx_reviews_seller on reviews (seller_id, created_at desc);

alter table transactions enable row level security;
alter table reviews enable row level security;

-- ============================================================
-- transactions
-- ============================================================

drop policy if exists "transactions_select_own" on transactions;
create policy "transactions_select_own" on transactions for select using (
  buyer_id = auth.uid() or seller_id = auth.uid()
);

-- A buyer may only claim for themselves, only against a published listing, and
-- the claim always starts as 'claimed' — never pre-confirmed.
drop policy if exists "transactions_insert_buyer" on transactions;
create policy "transactions_insert_buyer" on transactions for insert with check (
  buyer_id = auth.uid()
  and status = 'claimed'
  and exists (
    select 1 from listings l
    where l.id = listing_id and l.status = 'published' and l.seller_id = transactions.seller_id
  )
  -- A seller cannot review themselves.
  and buyer_id <> seller_id
);

-- Only the seller confirms/disputes, and only their own rows. Column-level
-- REVOKE stops a seller from rewriting who the transaction belongs to (the
-- lesson from migration 15: WITH CHECK alone cannot pin unchanged columns).
revoke update (buyer_id, seller_id, listing_id, created_at) on transactions from authenticated;

drop policy if exists "transactions_update_seller" on transactions;
create policy "transactions_update_seller" on transactions for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid() and status in ('confirmed', 'disputed'));

drop policy if exists "admin_all_transactions" on transactions;
create policy "admin_all_transactions" on transactions for all using (
  is_admin()
);

-- ============================================================
-- reviews
-- ============================================================

-- Reviews are public — that is the whole point of the trust layer.
drop policy if exists "reviews_select_public" on reviews;
create policy "reviews_select_public" on reviews for select using (true);

-- The core rule: a review requires a transaction that belongs to this buyer AND
-- that the seller already confirmed. Enforced in the policy, not just the app,
-- so it holds even against a direct API call.
drop policy if exists "reviews_insert_verified" on reviews;
create policy "reviews_insert_verified" on reviews for insert with check (
  buyer_id = auth.uid()
  and exists (
    select 1 from transactions t
    where t.id = transaction_id
      and t.buyer_id = auth.uid()
      and t.seller_id = reviews.seller_id
      and t.status = 'confirmed'
  )
);

drop policy if exists "admin_all_reviews" on reviews;
create policy "admin_all_reviews" on reviews for all using (
  is_admin()
);

-- ============================================================
-- Public rating summary
-- ============================================================

-- SECURITY DEFINER + pinned search_path (the migration-15 lesson). Safe to
-- expose publicly: it returns only aggregates over already-public reviews.
create or replace function seller_rating(p_seller_id uuid)
returns table (average numeric, total bigint) as $$
  select round(avg(rating), 1), count(*)
  from reviews
  where seller_id = p_seller_id;
$$ language sql stable security definer set search_path = public, pg_temp;
