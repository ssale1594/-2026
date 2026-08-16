-- تقويم فعاليات الزلفي (local events calendar) — PLAN.md §2.7, §11.3, §19.21.
-- A reason to open the site with no intention to buy: bazaars, family markets,
-- municipality activities, the weekly حراج. Community traffic that later walks
-- past the commercial listings.
--
-- Anyone signed in may submit; an admin reviews before it shows. Past events
-- disappear on their own through the RLS window rather than a cleanup job.

create table if not exists events (
  id bigserial primary key,
  created_by uuid references profiles(id) on delete set null,
  -- Optional: a seller can attach their business as the organizer.
  organizer_seller_id uuid references sellers(id) on delete set null,
  title text not null,
  description text,
  location_text text,
  neighborhood_id int references neighborhoods(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected')),
  created_at timestamptz default now(),
  constraint events_period_valid check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_events_upcoming
  on events (status, starts_at);

alter table events enable row level security;

-- Public sees reviewed events that haven't finished yet. coalesce lets a
-- single-moment event stay visible for the whole of its start day.
drop policy if exists "events_select_public" on events;
create policy "events_select_public" on events for select using (
  status = 'published'
  and coalesce(ends_at, starts_at + interval '1 day') > now()
);

drop policy if exists "events_select_own" on events;
create policy "events_select_own" on events for select using (
  created_by = auth.uid()
);

drop policy if exists "events_insert_own" on events;
create policy "events_insert_own" on events for insert with check (
  created_by = auth.uid() and status = 'pending_review'
);

-- status is the moderator's call only.
revoke update (status, created_by) on events from authenticated;

drop policy if exists "events_update_own" on events;
create policy "events_update_own" on events for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "admin_all_events" on events;
create policy "admin_all_events" on events for all using (is_admin());

-- admin_actions logs event moderation too.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'admin_actions_target_type_check') then
    alter table admin_actions drop constraint admin_actions_target_type_check;
  end if;

  alter table admin_actions add constraint admin_actions_target_type_check
    check (target_type in ('seller', 'listing', 'referral', 'offer', 'event', 'job'));
end $$;
