-- ============================================================
-- إعدادات الإشعارات عبر البريد الإلكتروني لكل مستخدم
-- ============================================================

alter table profiles add column if not exists email_notifications_enabled boolean not null default true;
alter table profiles add column if not exists email_digest_enabled boolean not null default true;

-- إعدادات تفصيلية لكل نوع إشعار (هل يرسل بالبريد أم لا)
alter table profiles add column if not exists notify_email_listing_published boolean not null default true;
alter table profiles add column if not exists notify_email_listing_rejected boolean not null default true;
alter table profiles add column if not exists notify_email_seller_approved boolean not null default true;
alter table profiles add column if not exists notify_email_seller_rejected boolean not null default true;
alter table profiles add column if not exists notify_email_transaction_claimed boolean not null default true;
alter table profiles add column if not exists notify_email_review_received boolean not null default true;
alter table profiles add column if not exists notify_email_vouch_received boolean not null default true;
alter table profiles add column if not exists notify_email_answer_received boolean not null default true;
alter table profiles add column if not exists notify_email_offer_published boolean not null default true;
alter table profiles add column if not exists notify_email_offer_rejected boolean not null default true;
alter table profiles add column if not exists notify_email_need_response boolean not null default true;

comment on column profiles.email_notifications_enabled is 'تشغيل/إيقاف كل رسائل البريد الإلكتروني للمستخدم';
comment on column profiles.email_digest_enabled is 'تلخيص يومي للإشعارات غير المقروءة بدل إرسالها فورًا';

-- ============================================================
-- سجل الإرسال البريدي (لمنع إرسال مكرر + تصحيح الأخطاء)
-- ============================================================

create table if not exists email_log (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete set null,
  email_to text not null,
  notification_type text,
  subject text not null,
  status text not null default 'pending', -- pending | sent | failed | skipped
  provider text, -- resend | brevo | smtp
  provider_message_id text,
  error_message text,
  notification_id bigint references notifications(id) on delete set null,
  is_digest boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_email_log_user on email_log (user_id, created_at desc);
create index if not exists idx_email_log_status on email_log (status, created_at);
create index if not exists idx_email_log_notification on email_log (notification_id) where notification_id is not null;

alter table email_log enable row level security;

drop policy if exists "email_log_select_own" on email_log;
create policy "email_log_select_own" on email_log for select using (
  user_id = auth.uid() or is_admin()
);

-- المستخدم العادي ما يقدر يعدل شيء، الأدمن فقط
drop policy if exists "email_log_admin_all" on email_log;
create policy "email_log_admin_all" on email_log for all using (is_admin());

-- ============================================================
-- دالة تحقق: هل يجب إرسال هذا النوع بالبريد لهذا المستخدم؟
-- تُستدعى من الـworker المرسل
-- ============================================================

create or replace function should_send_email_notification(
  p_user_id uuid,
  p_notification_type text
)
returns boolean as $$
declare
  v_global_enabled boolean;
  v_digest_enabled boolean;
  v_type_enabled boolean;
  v_column_name text;
begin
  select email_notifications_enabled, email_digest_enabled
  into v_global_enabled, v_digest_enabled
  from profiles where id = p_user_id;

  if v_global_enabled is null or not v_global_enabled then
    return false;
  end if;

  -- لو مفعّل الملخص اليومي، ما نرسل فوريًا (يوصل مع الملخص)
  -- باستثناء أنواع حساسة: رفض حساب، موافقة حساب، مطالبة تعامل
  if v_digest_enabled and p_notification_type not in ('seller_approved', 'seller_rejected', 'transaction_claimed') then
    return false;
  end if;

  v_column_name := 'notify_email_' || p_notification_type;
  begin
    execute format('select %I from profiles where id = $1', v_column_name)
      into v_type_enabled
      using p_user_id;
  exception when undefined_column then
    return v_global_enabled;
  end;

  return coalesce(v_type_enabled, true);
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function should_send_email_notification(uuid, text) from anon, authenticated;
grant execute on function should_send_email_notification(uuid, text) to service_role;

-- ============================================================
-- دالة جلب الإشعارات للملخص اليومي (Digest)
-- لكل مستخدم: إشعارات غير مقروءة أو غير مرسلة بالبريد من آخر 24 ساعة
-- ============================================================

create or replace function get_email_digest_batch(p_batch_size int default 100)
returns table (
  user_id uuid,
  user_email text,
  user_full_name text,
  notifications jsonb
) as $$
begin
  return query
  with users_to_process as (
    select distinct n.user_id
    from notifications n
    join profiles p on p.id = n.user_id
    where p.email_notifications_enabled = true
      and p.email_digest_enabled = true
      and n.created_at > now() - interval '48 hours'
      and not exists (
        select 1 from email_log el
        where el.user_id = n.user_id
          and el.is_digest = true
          and el.created_at > now() - interval '20 hours'
      )
    limit p_batch_size
  )
  select
    utp.user_id,
    u.email as user_email,
    p.full_name as user_full_name,
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'type', n.type,
        'title', n.title,
        'body', n.body,
        'link', n.link,
        'is_read', n.is_read,
        'created_at', n.created_at
      )
      order by n.created_at desc
    ) as notifications
  from users_to_process utp
  join notifications n on n.user_id = utp.user_id
  join profiles p on p.id = utp.user_id
  join auth.users u on u.id = utp.user_id
  where n.created_at > now() - interval '48 hours'
    and not n.is_read
  group by utp.user_id, u.email, p.full_name;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_email_digest_batch(int) from anon, authenticated;
grant execute on function get_email_digest_batch(int) to service_role;

-- ============================================================
-- دالة جلب الإشعارات للإرسال الفوري (غير المجمعة)
-- ============================================================

create or replace function get_instant_email_batch(p_batch_size int default 100)
returns table (
  notification_id bigint,
  user_id uuid,
  user_email text,
  notification_type text,
  title text,
  body text,
  link text,
  created_at timestamptz
) as $$
begin
  return query
  select
    n.id as notification_id,
    n.user_id,
    u.email as user_email,
    n.type as notification_type,
    n.title,
    n.body,
    n.link,
    n.created_at
  from notifications n
  join auth.users u on u.id = n.user_id
  where not exists (
    select 1 from email_log el
    where el.notification_id = n.id
      and el.status in ('sent', 'pending')
  )
  and should_send_email_notification(n.user_id, n.type)
  and u.email is not null
  and n.created_at > now() - interval '7 days'
  order by n.created_at asc
  limit p_batch_size;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function get_instant_email_batch(int) from anon, authenticated;
grant execute on function get_instant_email_batch(int) to service_role;

-- ============================================================
-- دالة تحديث حالة الإرسال في السجل
-- ============================================================

create or replace function mark_email_sent(
  p_log_id bigint,
  p_provider text,
  p_provider_msg_id text default null,
  p_error text default null
)
returns void as $$
begin
  update email_log set
    status = case when p_error is null then 'sent' else 'failed' end,
    provider = coalesce(p_provider, provider),
    provider_message_id = p_provider_msg_id,
    error_message = p_error,
    sent_at = case when p_error is null then now() else null end
  where id = p_log_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function mark_email_sent(bigint, text, text, text) from anon, authenticated;
grant execute on function mark_email_sent(bigint, text, text, text) to service_role;
