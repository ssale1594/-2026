-- Rate-limit view_count/contact_click_count so anyone can't inflate them with
-- unlimited unauthenticated POSTs (confirmed exploitable in STATUS.md's 2026-08-15
-- review — 3 rapid requests all counted). Deliberately a plain Postgres table
-- instead of a paid rate-limiting/Redis service: this project pays for nothing
-- beyond Supabase's free tier until it has real revenue (see STATUS.md).
--
-- Dedup is per (listing, visitor, day): the app hashes the visitor's IP with a
-- server-only secret (lib/record-interaction.ts) so this table never stores a
-- raw, reversible IP address.

create table if not exists interaction_log (
  id bigserial primary key,
  listing_id uuid references listings(id) on delete cascade not null,
  kind text not null check (kind in ('view', 'contact')),
  visitor_hash text not null,
  day date not null default current_date,
  unique (listing_id, kind, visitor_hash, day)
);

create index if not exists idx_interaction_log_listing on interaction_log (listing_id);

-- RLS with zero policies denies anon/authenticated direct access outright, even
-- though migration 15's default-privilege grants technically apply to this new
-- table too — only the SECURITY DEFINER functions below (running as the table
-- owner) can read or write it.
alter table interaction_log enable row level security;

create or replace function record_listing_view(p_listing_id uuid, p_visitor_hash text)
returns void as $$
declare
  v_is_new boolean;
begin
  insert into interaction_log (listing_id, kind, visitor_hash)
    select p_listing_id, 'view', p_visitor_hash
    where exists (select 1 from listings where id = p_listing_id and status = 'published')
  on conflict (listing_id, kind, visitor_hash, day) do nothing
  returning true into v_is_new;

  if v_is_new then
    update listings
      set view_count = view_count + 1
      where id = p_listing_id and status = 'published';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function record_contact_click(p_listing_id uuid, p_visitor_hash text)
returns void as $$
declare
  v_is_new boolean;
begin
  insert into interaction_log (listing_id, kind, visitor_hash)
    select p_listing_id, 'contact', p_visitor_hash
    where exists (select 1 from listings where id = p_listing_id and status = 'published')
  on conflict (listing_id, kind, visitor_hash, day) do nothing
  returning true into v_is_new;

  if v_is_new then
    update listings
      set contact_click_count = contact_click_count + 1
      where id = p_listing_id and status = 'published';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
