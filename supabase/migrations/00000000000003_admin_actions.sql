-- TECH.md §12.3 — audit log from day one: it looks trivial until there is a
-- dispute, and then it becomes the most important table in the system.

create table admin_actions (
  id bigserial primary key,
  admin_id uuid references profiles(id) not null,
  action text not null,
  target_type text not null check (target_type in ('seller', 'listing')),
  target_id uuid not null,
  reason text,
  created_at timestamptz default now()
);

create index on admin_actions (target_type, target_id);

alter table admin_actions enable row level security;

create policy "admin_actions_admin_only" on admin_actions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
