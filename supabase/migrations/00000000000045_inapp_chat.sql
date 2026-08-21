-- ============================================================
-- نظام الدردشة الداخلية بين البائع والعميل (In-App Chat)
-- ============================================================

create table if not exists chat_threads (
  id bigserial primary key,
  deal_id bigint references deals(id) on delete set null,
  listing_id uuid references listings(id) on delete set null,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  subject text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender_id uuid references profiles(id) on delete set null,
  unread_buyer_count integer not null default 0,
  unread_seller_count integer not null default 0,
  archived_by_buyer boolean not null default false,
  archived_by_seller boolean not null default false,
  check (buyer_id <> seller_id)
);

create index if not exists chat_threads_buyer_idx on chat_threads(buyer_id, last_message_at desc) where not archived_by_buyer;
create index if not exists chat_threads_seller_idx on chat_threads(seller_id, last_message_at desc) where not archived_by_seller;
create unique index if not exists chat_threads_pair_listing_unq
  on chat_threads(buyer_id, seller_id) where listing_id is null and deal_id is null;
create unique index if not exists chat_threads_pair_listing_with_listing_unq
  on chat_threads(buyer_id, seller_id, listing_id) where listing_id is not null;
create unique index if not exists chat_threads_pair_deal_unq
  on chat_threads(deal_id) where deal_id is not null;

alter table chat_threads enable row level security;

drop policy if exists "chat parties see their threads" on chat_threads;
create policy "chat parties see their threads"
  on chat_threads for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "chat parties update unread & archive flags" on chat_threads;
create policy "chat parties update unread & archive flags"
  on chat_threads for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- الحقول الحسّاسة تُثبَّت بحجب على مستوى العمود لا بـWITH CHECK: التعبير
-- هناك ما يرى الصف قبل التعديل (old/new صياغة مشغّلات لا سياسات، وكتابتها
-- خطأ صياغي يُفشل الهجرة). والسحب على مستوى الجدول أولاً إلزامي، وإلا بقي
-- منح الجدول من الهجرة 15 ساريًا وما نفع حجب العمود.
revoke update on chat_threads from authenticated;
grant update (
  unread_buyer_count, unread_seller_count, archived_by_buyer, archived_by_seller,
  last_message_at, last_message_body, last_message_sender_id
) on chat_threads to authenticated;

drop policy if exists "chat parties create threads between them" on chat_threads;
create policy "chat parties create threads between them"
  on chat_threads for insert with check (
    -- أحد الطرفين هو من يدير الإدراج
    (auth.uid() = buyer_id or auth.uid() = seller_id)
    -- والطرف الآخر يختلف عنه
    and buyer_id <> seller_id
    -- لا يوجد deal_id يخص طرف ثالث (مضمون ب fk ولكن نحفظ الصحة)
  );

grant select, insert on chat_threads to authenticated;

-- جدول الرسائل الفردية
create table if not exists chat_messages (
  id bigserial primary key,
  thread_id bigint not null references chat_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_by_buyer boolean not null default false,
  read_by_seller boolean not null default false,
  attachment_path text,
  attachment_meta jsonb default '{}'::jsonb,
  system_event text null -- e.g., "deal_created", "deal_status_changed"
);

create index if not exists chat_msgs_thread_idx on chat_messages(thread_id, created_at desc);
create index if not exists chat_msgs_sender_idx on chat_messages(sender_id);

alter table chat_messages enable row level security;

drop policy if exists "chat parties read messages of their thread" on chat_messages;
create policy "chat parties read messages of their thread"
  on chat_messages for select using (
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

drop policy if exists "chat parties insert messages in thread" on chat_messages;
create policy "chat parties insert messages in thread"
  on chat_messages for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

drop policy if exists "chat parties mark messages read" on chat_messages;
create policy "chat parties mark messages read"
  on chat_messages for update using (
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  ) with check (
    exists (
      select 1 from chat_threads t
      where t.id = thread_id and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

-- نص الرسالة ومرسِلها ومرفقاتها غير قابلة للتعديل — أعلام القراءة فقط.
revoke update on chat_messages from authenticated;
grant update (read_by_buyer, read_by_seller) on chat_messages to authenticated;

grant select, insert on chat_messages to authenticated;

-- ============================================================
-- Trigger تحديث أعداد غير المقروءة وآخر رسالة في الـ thread
-- ============================================================
create or replace function chat_thread_denorm() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t record;
  is_buyer boolean;
  is_seller boolean;
begin
  if tg_op = 'INSERT' then
    select * into t from chat_threads where id = new.thread_id;
    if found then
      is_buyer  := (new.sender_id = t.buyer_id);
      is_seller := (new.sender_id = t.seller_id);
      update chat_threads
      set
        last_message_at = now(),
        last_message_body = case when new.system_event is not null then null else left(new.body, 240) end,
        last_message_sender_id = new.sender_id,
        unread_buyer_count  = case when is_seller then unread_buyer_count + 1  else unread_buyer_count end,
        unread_seller_count = case when is_buyer  then unread_seller_count + 1 else unread_seller_count end
      where id = new.thread_id;
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists chat_messages_after_ins on chat_messages;
create trigger chat_messages_after_ins after insert on chat_messages
  for each row execute function chat_thread_denorm();

grant execute on function chat_thread_denorm() to authenticated;

-- دالة مساعدة: إعادة ضبط عداد غير المقروء للطرف عند فتح المحادثة
create or replace function chat_mark_thread_read(p_thread_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  t record;
begin
  if uid is null then return; end if;
  select * into strict t from chat_threads where id = p_thread_id;
  if uid = t.buyer_id then
    update chat_threads set unread_buyer_count = 0 where id = p_thread_id;
    update chat_messages set read_by_buyer = true where thread_id = p_thread_id and not read_by_buyer;
  elsif uid = t.seller_id then
    update chat_threads set unread_seller_count = 0 where id = p_thread_id;
    update chat_messages set read_by_seller = true where thread_id = p_thread_id and not read_by_seller;
  end if;
end; $$;
grant execute on function chat_mark_thread_read(bigint) to authenticated;

-- دالة مساعدة لجلب أو إنشاء محادثة بين طرفين عند فتح زر "دردشة" من صفحة الإعلان
create or replace function chat_upsert_thread(
  p_listing_id uuid,
  p_deal_id bigint,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_subject text default null
) returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  out_id bigint;
  the_subject text;
begin
  if uid is null or (uid <> p_buyer_id and uid <> p_seller_id) then
    raise exception 'غير مصرح به';
  end if;
  if p_buyer_id = p_seller_id then raise exception 'لا يمكن الدردشة مع نفسك'; end if;

  -- الطرف البائع لازم يكون بائعًا معتمدًا فعلاً. بدون هذا الشرط يقدر أي
  -- مستخدم يفتح محادثة مع أي مستخدم آخر بمجرد تمرير معرّفه — رسائل غير
  -- مطلوبة لأي شخص بالمنصة، لا تواصلاً مع متجر.
  if not exists (
    select 1 from sellers s
     where s.id = p_seller_id and s.verification_status = 'approved'
  ) then
    raise exception 'الطرف الآخر ليس بائعًا معتمدًا';
  end if;

  if p_deal_id is not null then
    insert into chat_threads(deal_id, buyer_id, seller_id, subject, last_message_at)
    values (p_deal_id, p_buyer_id, p_seller_id, coalesce(p_subject, 'محادثة صفقة'), coalesce((select created_at from deals where id = p_deal_id), now()))
    on conflict (deal_id) where deal_id is not null do update set subject = excluded.subject
    returning id into out_id;
    return out_id;
  end if;

  if p_listing_id is not null then
    -- نختار العنوان من listing لو متوفر
    the_subject := coalesce(p_subject, (select 'استفسار حول: ' || title from listings where id = p_listing_id));
    insert into chat_threads(listing_id, buyer_id, seller_id, subject, last_message_at)
    values (p_listing_id, p_buyer_id, p_seller_id, the_subject, now())
    on conflict (buyer_id, seller_id, listing_id) where listing_id is not null do update set subject = excluded.subject
    returning id into out_id;
    return out_id;
  end if;

  -- بدون listing/deal: محادثة عامة بين الطرفين
  the_subject := coalesce(p_subject, 'محادثة خاصة');
  insert into chat_threads(buyer_id, seller_id, subject, last_message_at)
  values (p_buyer_id, p_seller_id, the_subject, now())
  on conflict (buyer_id, seller_id) where listing_id is null and deal_id is null do update set subject = excluded.subject
  returning id into out_id;
  return out_id;
end; $$;
grant execute on function chat_upsert_thread(uuid,bigint,uuid,uuid,text) to authenticated;
