-- إشعارات داخلية (in-app notification centre). Every feature built so far
-- produces events a seller currently has to discover by manually re-checking a
-- page: an admin approved their listing, someone claimed a transaction, a
-- review landed, a neighbour vouched, an answer arrived on their question.
--
-- In-app rather than email/SMS on purpose: an email provider is a paid
-- dependency, and this project pays for nothing before it has revenue
-- (TECH.md "مبدأ التكلفة"). A notifications table costs nothing and is the
-- right substrate to add email on top of later.
--
-- Every trigger below is SECURITY DEFINER with a pinned search_path (the
-- migration-15 lesson) because it must insert a row for a *different* user than
-- the one performing the action, which RLS would otherwise refuse.

create table if not exists notifications (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user
  on notifications (user_id, is_read, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select using (
  user_id = auth.uid()
);

-- The only thing a user may change is the read flag on their own rows; every
-- other column is written by the triggers below.
revoke update (user_id, type, title, body, link, created_at) on notifications from authenticated;

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admin_all_notifications" on notifications;
create policy "admin_all_notifications" on notifications for all using (is_admin());

create or replace function notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void as $$
  insert into notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
$$ language sql security definer set search_path = public, pg_temp;

-- ============================================================
-- 1. Listing reviewed by an admin
-- ============================================================

create or replace function notify_listing_reviewed()
returns trigger as $$
begin
  if old.status = new.status then
    return null;
  end if;

  if new.status = 'published' then
    perform notify(
      new.seller_id, 'listing_published', 'تم نشر إعلانك',
      new.title, '/listing/' || new.slug
    );
  elsif new.status = 'rejected' then
    perform notify(
      new.seller_id, 'listing_rejected', 'إعلانك محتاج تعديل',
      new.title, '/dashboard'
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_listing_reviewed on listings;
create trigger trg_notify_listing_reviewed
  after update of status on listings
  for each row execute function notify_listing_reviewed();

-- ============================================================
-- 2. Seller account approved / rejected
-- ============================================================

create or replace function notify_seller_reviewed()
returns trigger as $$
begin
  if old.verification_status = new.verification_status then
    return null;
  end if;

  if new.verification_status = 'approved' then
    perform notify(
      new.id, 'seller_approved', 'تم اعتماد حسابك',
      'صار بإمكانك نشر إعلاناتك والرد على الطلبات.', '/dashboard'
    );
  elsif new.verification_status = 'rejected' then
    perform notify(
      new.id, 'seller_rejected', 'حسابك ما تم اعتماده',
      'تواصل معنا لمعرفة التفاصيل.', '/dashboard'
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_seller_reviewed on sellers;
create trigger trg_notify_seller_reviewed
  after update of verification_status on sellers
  for each row execute function notify_seller_reviewed();

-- ============================================================
-- 3. A buyer claims a transaction (seller must confirm it)
-- ============================================================

create or replace function notify_transaction_claimed()
returns trigger as $$
begin
  perform notify(
    new.seller_id, 'transaction_claimed', 'عميل يقول إنه تعامل معك',
    'أكّد التعامل عشان يقدر يقيّمك.', '/dashboard/transactions'
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_transaction_claimed on transactions;
create trigger trg_notify_transaction_claimed
  after insert on transactions
  for each row execute function notify_transaction_claimed();

-- ============================================================
-- 4. A review is published
-- ============================================================

create or replace function notify_review_created()
returns trigger as $$
declare
  v_slug text;
begin
  select slug into v_slug from sellers where id = new.seller_id;

  perform notify(
    new.seller_id, 'review_received', 'وصلك تقييم جديد',
    new.rating || ' من 5', '/seller/' || v_slug
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_review_created on reviews;
create trigger trg_notify_review_created
  after insert on reviews
  for each row execute function notify_review_created();

-- ============================================================
-- 5. A neighbour vouches for the seller
-- ============================================================

create or replace function notify_vouch_created()
returns trigger as $$
declare
  v_slug text;
begin
  select slug into v_slug from sellers where id = new.seller_id;

  perform notify(
    new.seller_id, 'vouch_received', 'أحد الجيران وصّى فيك',
    new.note, '/seller/' || v_slug
  );
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_vouch_created on vouches;
create trigger trg_notify_vouch_created
  after insert on vouches
  for each row execute function notify_vouch_created();

-- ============================================================
-- 6. Someone answers your question
-- ============================================================

create or replace function notify_answer_created()
returns trigger as $$
declare
  v_author uuid;
begin
  select author_id into v_author from questions where id = new.question_id;

  -- Answering your own question shouldn't notify you.
  if v_author is not null and v_author <> new.author_id then
    perform notify(
      v_author, 'answer_received', 'وصلك رد على سؤالك',
      left(new.body, 120), '/ask/' || new.question_id
    );
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_answer_created on answers;
create trigger trg_notify_answer_created
  after insert on answers
  for each row execute function notify_answer_created();

-- ============================================================
-- 7. Offer reviewed by an admin
-- ============================================================

create or replace function notify_offer_reviewed()
returns trigger as $$
begin
  if old.status = new.status then
    return null;
  end if;

  if new.status = 'published' then
    perform notify(new.seller_id, 'offer_published', 'تم نشر عرضك', new.title, '/offers');
  elsif new.status = 'rejected' then
    perform notify(new.seller_id, 'offer_rejected', 'عرضك ما تم نشره', new.title, '/dashboard/offers');
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_offer_reviewed on offers;
create trigger trg_notify_offer_reviewed
  after update of status on offers
  for each row execute function notify_offer_reviewed();

create or replace function unread_notification_count()
returns bigint as $$
  select count(*) from notifications
  where user_id = auth.uid() and not is_read;
$$ language sql stable security definer set search_path = public, pg_temp;
