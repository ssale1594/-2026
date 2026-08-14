-- Root cause of the empty-results mystery: this Supabase project enables RLS by
-- default on every new table, even though our migrations never called
-- `enable row level security` on these four. With RLS on and zero policies,
-- every role except service_role (which bypasses RLS) saw nothing — not an
-- error, just an empty set, which is what made this so hard to spot.
--
-- These four are non-sensitive public reference/lookup data (categories to
-- browse, regions/neighborhoods to filter by, subscription plans to display),
-- so a public read policy is the correct fix, not disabling RLS.

alter table categories enable row level security;
alter table regions enable row level security;
alter table neighborhoods enable row level security;
alter table plans enable row level security;

drop policy if exists "categories_public_read" on categories;
create policy "categories_public_read" on categories for select using (true);

drop policy if exists "regions_public_read" on regions;
create policy "regions_public_read" on regions for select using (true);

drop policy if exists "neighborhoods_public_read" on neighborhoods;
create policy "neighborhoods_public_read" on neighborhoods for select using (true);

drop policy if exists "plans_public_read" on plans;
create policy "plans_public_read" on plans for select using (true);
