-- رعاية موسمية للأقسام (seasonal section sponsorship) — the single most
-- repeated monetization idea across every brainstorm source (PLAN.md §16.2,
-- §17.4-5, §18.4, §19.2, §20.6). A local business sponsors a whole category or
-- journey for a period; their name shows on that page.
--
-- Deliberately admin-managed with no self-serve checkout: Tap onboarding is
-- deferred (STATUS.md), and at this stage sponsorships are sold face to face
-- anyway. The schema records what was sold so the display is automatic.

create table if not exists sponsorships (
  id bigserial primary key,
  sponsor_name text not null,
  sponsor_url text,
  message text,
  -- 'home' has no target id; category/journey point at their own tables.
  target_type text not null check (target_type in ('home', 'category', 'journey')),
  target_id int,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  -- A category/journey sponsorship must name its target; a home one must not.
  constraint sponsorships_target_id_matches_type check (
    (target_type = 'home' and target_id is null)
    or (target_type in ('category', 'journey') and target_id is not null)
  ),
  constraint sponsorships_period_valid check (ends_at > starts_at)
);

create index if not exists idx_sponsorships_lookup
  on sponsorships (target_type, target_id, is_active, starts_at, ends_at);

alter table sponsorships enable row level security;

-- Public read: the sponsor banner is public by definition. Writes are admin
-- only (no insert/update policy for anon/authenticated at all).
drop policy if exists "sponsorships_select_public" on sponsorships;
create policy "sponsorships_select_public" on sponsorships for select using (
  is_active and now() >= starts_at and now() < ends_at
);

drop policy if exists "admin_all_sponsorships" on sponsorships;
create policy "admin_all_sponsorships" on sponsorships for all using (
  is_admin()
);
