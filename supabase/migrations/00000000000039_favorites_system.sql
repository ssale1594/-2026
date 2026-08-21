-- ============================================================
-- نظام المفضلة / قائمة الأمنيات
-- ============================================================

create table if not exists favorite_listings (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique(user_id, listing_id)
);

create index if not exists favorite_listings_user_idx on favorite_listings(user_id);
create index if not exists favorite_listings_listing_idx on favorite_listings(listing_id);

alter table favorite_listings enable row level security;

drop policy if exists "users see own favorites" on favorite_listings;
create policy "users see own favorites"
  on favorite_listings for select using (auth.uid() = user_id);

drop policy if exists "users insert own favorites" on favorite_listings;
create policy "users insert own favorites"
  on favorite_listings for insert with check (
    auth.uid() = user_id and
    exists (select 1 from listings l where l.id = listing_id and l.status = 'published')
  );

drop policy if exists "users delete own favorites" on favorite_listings;
create policy "users delete own favorites"
  on favorite_listings for delete using (auth.uid() = user_id);

-- دالة: عدد الإعلانات المفضلة لدى المستخدم
create or replace function get_favorite_count(p_user_id uuid)
returns bigint
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return (select count(*) from favorite_listings where user_id = p_user_id);
end; $$;
grant execute on function get_favorite_count(uuid) to authenticated;
