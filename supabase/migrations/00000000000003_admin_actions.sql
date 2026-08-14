-- TECH.md §12.3 — audit log from day one: it looks trivial until there is a
-- dispute, and then it becomes the most important table in the system.
--
-- Idempotent throughout: written so it can be re-run safely after a partial
-- failure elsewhere in the same paste (see STATUS.md for what happened here).

create table if not exists admin_actions (
  id bigserial primary key,
  admin_id uuid references profiles(id) not null,
  action text not null,
  target_type text not null check (target_type in ('seller', 'listing')),
  target_id uuid not null,
  reason text,
  created_at timestamptz default now()
);

create index if not exists admin_actions_target_type_target_id_idx
  on admin_actions (target_type, target_id);

alter table admin_actions enable row level security;

drop policy if exists "admin_actions_admin_only" on admin_actions;
create policy "admin_actions_admin_only" on admin_actions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
