-- Fix: the admin_* policies in the initial schema query `profiles` from inside a
-- policy that is itself on `profiles`, which makes Postgres re-evaluate the same
-- policy recursively (error 42P17: infinite recursion detected in policy).
-- A security definer function bypasses RLS for that single lookup, breaking the cycle.

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

drop policy if exists "admin_all_profiles" on profiles;
drop policy if exists "admin_all_sellers" on sellers;
drop policy if exists "admin_all_listings" on listings;
drop policy if exists "admin_actions_admin_only" on admin_actions;

create policy "admin_all_profiles" on profiles for all using (is_admin());
create policy "admin_all_sellers" on sellers for all using (is_admin());
create policy "admin_all_listings" on listings for all using (is_admin());
create policy "admin_actions_admin_only" on admin_actions for all using (is_admin());
