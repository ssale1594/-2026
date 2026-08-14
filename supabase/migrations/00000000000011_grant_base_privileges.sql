-- Fix: anon/authenticated had no base GRANTs on public-schema tables, so every
-- query returned an empty set regardless of RLS — confirmed by querying with the
-- secret key (sees data) vs the publishable/anon key (saw nothing).
--
-- This is the standard Supabase bootstrap grant that normally ships with a new
-- project; RLS policies (already in place from migration 1 onward) still do the
-- real access control on top of these broad grants — this step alone does not
-- bypass any policy, it only lets the roles reach the table at all.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
