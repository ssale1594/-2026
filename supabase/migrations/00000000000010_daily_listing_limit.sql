-- Daily cap on new listings per seller (PLAN.md §4.5 — anti-spam for new/fake
-- accounts). Enforced in the RLS policy itself, same pattern as
-- can_create_listing(), so it can't be bypassed by calling the API directly.

create or replace function can_create_listing_today(p_seller_id uuid)
returns boolean as $$
  select count(*) < 3
  from listings
  where seller_id = p_seller_id
    and created_at >= date_trunc('day', now());
$$ language sql stable security definer;

drop policy if exists "listings_insert_own" on listings;

create policy "listings_insert_own" on listings for insert with check (
  seller_id = auth.uid()
  and can_create_listing(auth.uid())
  and can_create_listing_today(auth.uid())
);
