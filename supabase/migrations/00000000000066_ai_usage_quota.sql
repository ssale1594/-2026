-- ============================================================
-- حد استخدام مساعد كتابة الإعلانات
-- ============================================================
-- طُبّقت على القاعدة الحية في 2026-08-22 عبر Supabase MCP.
--
-- كل استدعاء للنموذج يكلّف مالًا. بلا حدّ، سكربت واحد يستنزف الرصيد.
-- الحد على البائع نفسه لا على IP: الميزة للبائعين المسجّلين فقط، وربطها
-- بالحساب أدق من ربطها بعنوان قد يتغيّر أو يُشارَك بين عدة أشخاص.

create table if not exists ai_usage_log (
  id bigserial primary key,
  seller_id uuid not null references sellers(id) on delete cascade,
  feature text not null,
  day date not null default current_date,
  used_count int not null default 1,
  created_at timestamptz not null default now(),
  unique (seller_id, feature, day)
);

create index if not exists ai_usage_seller_idx on ai_usage_log(seller_id, day desc);
alter table ai_usage_log enable row level security;

drop policy if exists "ai_usage own read" on ai_usage_log;
create policy "ai_usage own read"
  on ai_usage_log for select using (seller_id = auth.uid());

drop policy if exists "ai_usage admin all" on ai_usage_log;
create policy "ai_usage admin all" on ai_usage_log for all using (is_admin());

grant select on ai_usage_log to authenticated;
-- لا insert ولا update مباشرين: العدّاد يُزاد عبر الدالة فقط، وإلا صار
-- بإمكان البائع تصفير عدّاده وتجاوز الحد.
revoke insert, update, delete on ai_usage_log from anon, authenticated;

-- ============================================================
-- المطالبة بحصة: ترجع true إن سُمح، وتزيد العدّاد ذرّيًا
-- ============================================================
-- الزيادة والفحص في عبارة واحدة عمدًا: فحصٌ ثم زيادة منفصلان يسمحان
-- لطلبين متزامنين بتجاوز الحد معًا.
create or replace function claim_ai_quota(p_feature text, p_daily_limit int default 10)
returns table (allowed boolean, used_today int, daily_limit int)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_used int;
begin
  if v_uid is null then
    raise exception 'يلزم تسجيل الدخول';
  end if;
  if not exists (select 1 from sellers s where s.id = v_uid) then
    raise exception 'الميزة للبائعين فقط';
  end if;

  p_daily_limit := greatest(1, least(coalesce(p_daily_limit, 10), 100));

  insert into ai_usage_log (seller_id, feature, day, used_count)
  values (v_uid, p_feature, current_date, 1)
  on conflict (seller_id, feature, day)
    do update set used_count = ai_usage_log.used_count + 1
  returning used_count into v_used;

  -- تجاوز الحد يعيد allowed=false، والعدّاد يبقى مرفوعًا: هذا مقصود
  -- ليجعل المحاولات المتكررة بعد الحد بلا فائدة.
  allowed := (v_used <= p_daily_limit);
  used_today := v_used;
  daily_limit := p_daily_limit;
  return next;
end $$;

revoke all on function claim_ai_quota(text, int) from public, anon;
grant execute on function claim_ai_quota(text, int) to authenticated;
