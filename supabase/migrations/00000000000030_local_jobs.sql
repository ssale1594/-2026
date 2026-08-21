-- وظائف محلية (local jobs) — PLAN.md §2.6. Shops in Al-Zulfi announce openings
-- and residents apply through the platform. Reaches a group the marketplace
-- otherwise misses entirely: people who aren't buying anything.
--
-- Applications carry a WhatsApp number rather than a CV upload: the whole
-- platform's contact model is wa.me (TECH.md §4), and a file-upload pipeline
-- for CVs would add storage cost and PII handling for no real gain here.

create table if not exists jobs (
  id bigserial primary key,
  seller_id uuid references sellers(id) on delete cascade not null,
  title text not null,
  description text,
  job_type text not null default 'full_time'
    check (job_type in ('full_time', 'part_time', 'temporary')),
  salary_text text,
  neighborhood_id int references neighborhoods(id),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'closed', 'rejected')),
  expires_at timestamptz not null default (now() + interval '45 days'),
  created_at timestamptz default now()
);

create index if not exists idx_jobs_live on jobs (status, expires_at, created_at desc);

create table if not exists job_applications (
  id bigserial primary key,
  job_id bigint references jobs(id) on delete cascade not null,
  applicant_id uuid references profiles(id) on delete cascade not null,
  message text,
  contact_whatsapp text not null,
  created_at timestamptz default now(),
  unique (job_id, applicant_id)
);

create index if not exists idx_job_applications_job on job_applications (job_id);

alter table jobs enable row level security;
alter table job_applications enable row level security;

drop policy if exists "jobs_select_public" on jobs;
create policy "jobs_select_public" on jobs for select using (
  status = 'published' and expires_at > now()
);

drop policy if exists "jobs_select_own" on jobs;
create policy "jobs_select_own" on jobs for select using (seller_id = auth.uid());

drop policy if exists "jobs_insert_own" on jobs;
create policy "jobs_insert_own" on jobs for insert with check (
  seller_id = auth.uid()
  and status = 'pending_review'
  and exists (
    select 1 from sellers s
    where s.id = auth.uid() and s.verification_status = 'approved'
  )
);

revoke update (seller_id) on jobs from authenticated;

-- The seller may close their own posting, but publishing stays with the admin,
-- so the WITH CHECK pins what a seller is allowed to move status *to*.
drop policy if exists "jobs_update_own" on jobs;
create policy "jobs_update_own" on jobs for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid() and status in ('pending_review', 'closed'));

drop policy if exists "admin_all_jobs" on jobs;
create policy "admin_all_jobs" on jobs for all using (is_admin());

-- Applications are private between applicant and the hiring seller.
drop policy if exists "job_applications_select_own" on job_applications;
create policy "job_applications_select_own" on job_applications for select using (
  applicant_id = auth.uid()
  or exists (select 1 from jobs j where j.id = job_id and j.seller_id = auth.uid())
);

drop policy if exists "job_applications_insert_own" on job_applications;
create policy "job_applications_insert_own" on job_applications for insert with check (
  applicant_id = auth.uid()
  and exists (
    select 1 from jobs j
    where j.id = job_id and j.status = 'published' and j.expires_at > now()
  )
);

drop policy if exists "admin_all_job_applications" on job_applications;
create policy "admin_all_job_applications" on job_applications for all using (is_admin());

-- Tell the hiring seller a new application landed (reuses the notification
-- centre from migration 28).
create or replace function notify_job_application()
returns trigger as $$
declare
  v_seller uuid;
  v_title text;
begin
  select seller_id, title into v_seller, v_title from jobs where id = new.job_id;

  if v_seller is not null then
    perform notify(
      v_seller, 'job_application', 'وصلك طلب توظيف جديد',
      v_title, '/dashboard/jobs'
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_job_application on job_applications;
create trigger trg_notify_job_application
  after insert on job_applications
  for each row execute function notify_job_application();

create or replace function notify_job_reviewed()
returns trigger as $$
begin
  if old.status = new.status then
    return null;
  end if;

  if new.status = 'published' then
    perform notify(new.seller_id, 'job_published', 'تم نشر إعلان الوظيفة', new.title, '/jobs');
  elsif new.status = 'rejected' then
    perform notify(new.seller_id, 'job_rejected', 'إعلان الوظيفة ما تم نشره', new.title, '/dashboard/jobs');
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_job_reviewed on jobs;
create trigger trg_notify_job_reviewed
  after update of status on jobs
  for each row execute function notify_job_reviewed();
