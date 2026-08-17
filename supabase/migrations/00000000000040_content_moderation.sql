-- ============================================================
-- نظام الإبلاغ عن المحتوى + تدقيق الإدارة
-- ============================================================

create table if not exists content_reports (
  id bigserial primary key,
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'seller', 'review', 'comment', 'event', 'job', 'need', 'offer')),
  target_id bigint not null,
  reason_code text not null check (reason_code in (
    'spam',               -- رسائل مزعجة / إعلانات مكررة
    'inappropriate',      -- محتوى غير لائق أو للكبار فقط
    'fraud',              -- نصب / احتيال
    'wrong_price',        -- تسعير غير عادل / مخالف
    'wrong_category',     -- تصنيف خاطئ
    'duplicate',          -- تكرار مع إعلان آخر
    'expired',            -- السلعة انتهت الصلاحية أو بيعت
    'legal',              -- مخالفة قانونية / سجائر / أجهزة غير مسموح
    'other'               -- أخرى
  )),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'rejected', 'escalated')),
  resolution text,
  action_taken text,
  handled_by uuid references profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on content_reports(status);
create index if not exists reports_target_idx on content_reports(target_type, target_id);
create index if not exists reports_reporter_idx on content_reports(reporter_id);

alter table content_reports enable row level security;

drop policy if exists "reporter sees own report" on content_reports;
create policy "reporter sees own report"
  on content_reports for select using (auth.uid() = reporter_id);

drop policy if exists "authenticated can create report" on content_reports;
create policy "authenticated can create report"
  on content_reports for insert with check (auth.uid() = reporter_id and length(coalesce(details, '')) <= 2000);

-- تقارير تظهر فقط للإدارة في select كامل — من خلال service role عبر صفحة الإدارة

-- دالة: إحصائيات تقارير التدقيق للإدارة
create or replace function moderation_stats()
returns table (
  kpi text,
  val bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Unauthorized';
  end if;
  return query select * from (values
    ('pending',   (select count(*) from content_reports where status = 'pending')::bigint),
    ('reviewing', (select count(*) from content_reports where status = 'reviewing')::bigint),
    ('today',     (select count(*) from content_reports where created_at::date = now()::date)::bigint),
    ('week',      (select count(*) from content_reports where created_at > now() - interval '7 days')::bigint),
    ('rejected',  (select count(*) from content_reports where status = 'rejected')::bigint),
    ('resolved',  (select count(*) from content_reports where status = 'resolved')::bigint)
  ) t(kpi, val);
end; $$;
revoke all on function moderation_stats() from anon, authenticated;
grant execute on function moderation_stats() to service_role;

-- الأسباب المتاحة
comment on column content_reports.reason_code is 'spam|inappropriate|fraud|wrong_price|wrong_category|duplicate|expired|legal|other';
