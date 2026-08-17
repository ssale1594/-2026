-- ============================================================
-- نظام الحجوزات (Bookings) للخدمات — دوام البائع الأسبوعي + الحجوزات
-- ============================================================
--
-- الطرف البائع يشير إلى sellers(id) لا profiles(id): المعرّف نفسه (راجع
-- الهجرة 01)، لكنه يفرض أن الطرف بائع فعلاً، ويعطي PostgREST مسار ربط
-- مباشر لجلب business_name/slug — وهي أعمدة غير موجودة على profiles.

-- قيد exclude أدناه يخلط uuid و date (بمعامل =) مع int4range (بمعامل &&)
-- داخل فهرس GiST واحد. GiST لا يعرف = على uuid/date إلا بهذا الامتداد.
create extension if not exists btree_gist;

create table if not exists seller_availability (
  id bigserial primary key,
  seller_id uuid not null references sellers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=الأحد، 6=السبت
  start_minute smallint not null check (start_minute between 0 and 1439), -- 0 = 00:00
  end_minute smallint not null check (end_minute between 0 and 1440),
  is_closed boolean not null default false,
  slot_duration_minutes smallint not null default 60 check (slot_duration_minutes in (15, 30, 45, 60, 90, 120)),
  buffer_minutes smallint not null default 0 check (buffer_minutes between 0 and 240),
  max_parallel_bookings smallint not null default 1 check (max_parallel_bookings between 1 and 20),
  created_at timestamptz not null default now(),
  unique (seller_id, day_of_week),
  check (is_closed or end_minute > start_minute)
);

create index if not exists sched_seller_idx on seller_availability(seller_id);
alter table seller_availability enable row level security;

-- الدوام الأسبوعي معلومة عامة بطبيعتها — المشتري لازم يشوفها ليحجز.
drop policy if exists "seller_av seller read own" on seller_availability;
drop policy if exists "seller_av public read approved" on seller_availability;
drop policy if exists "seller_av public read" on seller_availability;
create policy "seller_av public read" on seller_availability for select using (true);

-- USING مطلوب هنا وليس WITH CHECK وحده: بدونه يعتبره Postgres true، فأي
-- مستخدم مسجّل يقدر يحذف دوام أي بائع (DELETE لا يفحص إلا USING).
drop policy if exists "seller_av seller manage own" on seller_availability;
create policy "seller_av seller manage own"
  on seller_availability for all
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

grant select on seller_availability to anon, authenticated;
grant insert, update, delete on seller_availability to authenticated;

create table if not exists seller_bookings (
  id bigserial primary key,
  seller_id uuid not null references sellers(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  deal_id bigint references deals(id) on delete set null,
  booking_date date not null,
  start_minute smallint not null check (start_minute between 0 and 1439),
  duration_minutes smallint not null check (duration_minutes between 15 and 480),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  customer_name text check (char_length(coalesce(customer_name, '')) <= 80),
  customer_phone text check (char_length(coalesce(customer_phone, '')) <= 30),
  service_title text check (char_length(coalesce(service_title, '')) <= 120),
  quoted_price_sar numeric(12,2) check (quoted_price_sar is null or quoted_price_sar > 0),
  notes text check (char_length(coalesce(notes, '')) <= 500),
  cancel_reason text check (char_length(coalesce(cancel_reason, '')) <= 300),
  cancelled_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> buyer_id),
  -- لا حجزين متداخلين لنفس البائع ما لم يكن أحدهما ملغى
  exclude using gist (
    seller_id with =,
    booking_date with =,
    int4range(start_minute, start_minute + duration_minutes, '[)') with &&
  ) where (status <> 'cancelled')
);

create index if not exists bookings_seller_date_idx on seller_bookings(seller_id, booking_date);
create index if not exists bookings_buyer_idx on seller_bookings(buyer_id, booking_date desc);
create index if not exists bookings_status_date_idx on seller_bookings(status, booking_date);

alter table seller_bookings enable row level security;

drop policy if exists "bookings parties read" on seller_bookings;
create policy "bookings parties read"
  on seller_bookings for select using (seller_id = auth.uid() or buyer_id = auth.uid());

drop policy if exists "bookings buyer inserts" on seller_bookings;
create policy "bookings buyer inserts"
  on seller_bookings for insert with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and status = 'pending'
    and deal_id is null
    and booking_date >= current_date
    and duration_minutes in (15, 30, 45, 60, 90, 120)
  );

-- طرفا الحجز فقط يقدران يحدّثانه. أي تحويل حالة *مسموح* يفرضه المشغّل
-- أدناه، لا هذه السياسة: تعبير WITH CHECK ما يقدر يشوف الصف قبل التعديل
-- (old/new صياغة مشغّلات لا سياسات)، فمحاولة كتابتها هنا خطأ صياغي يفشل
-- عند تطبيق الهجرة أصلاً.
drop policy if exists "bookings buyer cancels pending only" on seller_bookings;
drop policy if exists "bookings seller manage" on seller_bookings;
drop policy if exists "bookings parties update" on seller_bookings;
create policy "bookings parties update"
  on seller_bookings for update
  using (seller_id = auth.uid() or buyer_id = auth.uid())
  with check (seller_id = auth.uid() or buyer_id = auth.uid());

grant select, insert on seller_bookings to authenticated;

-- ولا يقدر أي طرف يعيد كتابة تفاصيل الحجز نفسه بعد إنشائه — حجب على
-- مستوى العمود، لأن WITH CHECK لا يثبّت عمودًا على قيمته السابقة.
-- السحب على مستوى الجدول أولاً إلزامي: في Postgres حجب عمود مع بقاء
-- منح على مستوى الجدول لا أثر له إطلاقًا (الهجرة 15 منحت update على كل
-- الجداول وجعلته الافتراضي لكل جدول لاحق).
revoke update on seller_bookings from authenticated;
grant update (status, cancel_reason, cancelled_by, quoted_price_sar, updated_at)
  on seller_bookings to authenticated;

-- ============================================================
-- تحويلات الحالة المسموحة — يفرضها مشغّل لأن السياسة لا ترى الحالة السابقة
-- ============================================================
create or replace function seller_bookings_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_is_seller boolean := (v_uid = old.seller_id);
  v_is_buyer boolean := (v_uid = old.buyer_id);
begin
  new.updated_at := now();

  if new.status is distinct from old.status then
    if v_is_seller then
      -- البائع: يقبل أو يرفض المعلّق، ويغلق المؤكّد
      if not (
        (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or
        (old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'no_show'))
      ) then
        raise exception 'تحويل حالة غير مسموح للبائع: % → %', old.status, new.status;
      end if;
    elsif v_is_buyer then
      -- المشتري: يلغي حجزه ما دام لم يُؤكَّد بعد، ولا شيء غير ذلك
      if not (old.status = 'pending' and new.status = 'cancelled') then
        raise exception 'المشتري يقدر يلغي الحجز المعلّق فقط';
      end if;
      new.cancelled_by := old.buyer_id;
    else
      raise exception 'لست طرفًا في هذا الحجز';
    end if;
  end if;

  if new.status = 'confirmed' and old.status <> 'confirmed' then new.confirmed_at := now(); end if;
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at := now(); end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := coalesce(new.cancelled_by, v_uid);
  end if;

  return new;
end; $$;

drop trigger if exists seller_bookings_ts_trigger on seller_bookings;
drop trigger if exists seller_bookings_guard_trigger on seller_bookings;
create trigger seller_bookings_guard_trigger before update on seller_bookings
  for each row execute function seller_bookings_guard();

-- ============================================================
-- الفترات المتاحة للأيام القادمة — تغذّي تقويم صفحة الحجز
-- ============================================================
create or replace function seller_free_slots(
  p_seller_id uuid,
  p_start_date date,
  p_days int default 14
)
returns table (
  slot_date date,
  start_minute smallint,
  end_minute smallint,
  is_available boolean,
  overlap_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_sched record;
  day_cursor date;
  cur_start integer;
  cur_end integer;
  slot_dur integer;
  buff integer;
  max_parallel integer;
  v_count bigint;
begin
  for day_cursor in
    select p_start_date + generate_series(0, greatest(1, least(p_days, 60)) - 1)
  loop
    -- isodow: 1=الاثنين .. 7=الأحد، والقسمة على 7 تحوّلها إلى 0=الأحد
    select * into v_sched
      from seller_availability s
     where s.seller_id = p_seller_id
       and s.day_of_week = (extract(isodow from day_cursor)::int % 7);

    if not found or v_sched.is_closed then
      continue;
    end if;

    slot_dur := coalesce(v_sched.slot_duration_minutes, 60);
    buff := coalesce(v_sched.buffer_minutes, 0);
    max_parallel := coalesce(v_sched.max_parallel_bookings, 1);

    cur_start := v_sched.start_minute;
    while cur_start + slot_dur <= v_sched.end_minute loop
      cur_end := cur_start + slot_dur;

      select coalesce(count(*), 0) into v_count
        from seller_bookings b
       where b.seller_id = p_seller_id
         and b.status <> 'cancelled'
         and b.booking_date = day_cursor
         and int4range(b.start_minute - buff, b.start_minute + b.duration_minutes + buff, '[)')
             && int4range(cur_start, cur_end, '[)');

      -- الفترات الماضية من اليوم الحالي تُعرض مشغولة لا متاحة
      slot_date := day_cursor;
      start_minute := cur_start::smallint;
      end_minute := cur_end::smallint;
      overlap_count := v_count;
      is_available := (v_count < max_parallel)
        and (day_cursor > current_date
             or cur_start > (extract(hour from now())::int * 60 + extract(minute from now())::int));
      return next;

      cur_start := cur_start + slot_dur;
    end loop;
  end loop;
  return;
end; $$;
grant execute on function seller_free_slots(uuid, date, int) to anon, authenticated;

-- ============================================================
-- عند التأكيد: تُنشأ صفقة تلقائيًا بالسعر المتفق عليه
-- ============================================================
create or replace function booking_confirmed_create_deal() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  new_deal_id bigint;
  v_from text;
  v_to text;
begin
  if old.status <> 'pending' or new.status <> 'confirmed' then return new; end if;
  if new.deal_id is not null then return new; end if;

  v_from := lpad((new.start_minute / 60)::text, 2, '0') || ':' ||
            lpad((new.start_minute % 60)::text, 2, '0');
  v_to := lpad(((new.start_minute + new.duration_minutes) / 60)::text, 2, '0') || ':' ||
          lpad(((new.start_minute + new.duration_minutes) % 60)::text, 2, '0');

  insert into deals (
    seller_id, buyer_id, listing_id, title, description,
    price_agreed_sar, status, scheduled_at
  )
  values (
    new.seller_id, new.buyer_id, new.listing_id,
    format('حجز موعد: %s - %s',
           coalesce(new.service_title, 'حجز خدمة'),
           to_char(new.booking_date, 'DD/MM/YYYY')),
    format('حجز من %s إلى %s لمدة %s دقيقة. ملاحظة: %s',
           v_from, v_to, new.duration_minutes, coalesce(new.notes, '—')),
    new.quoted_price_sar,
    'accepted',
    (new.booking_date + make_interval(mins => new.start_minute))::timestamptz
  )
  returning id into new_deal_id;

  new.deal_id := new_deal_id;
  return new;
end; $$;

drop trigger if exists booking_confirmed_deal_trigger on seller_bookings;
-- الاسم يسبق seller_bookings_guard_trigger أبجديًا، فيعمل قبله — وهذا مقصود:
-- الحارس يرفض التحويل غير المسموح، لكن هذا يقرأ old/new نفسها ولا يعتمد عليه.
create trigger booking_confirmed_deal_trigger before update on seller_bookings
  for each row execute function booking_confirmed_create_deal();

-- ============================================================
-- إشعارات طرفي الحجز
-- ============================================================
create or replace function bookings_notify() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_id uuid;
  title_str text;
  body_str text;
  the_link text;
  dt_str text;
  cancelled_by_buyer boolean;
begin
  dt_str := to_char(new.booking_date, 'DD/MM/YYYY') || ' الساعة ' ||
            lpad((new.start_minute / 60)::text, 2, '0') || ':' ||
            lpad((new.start_minute % 60)::text, 2, '0');

  if tg_op = 'INSERT' then
    title_str := '📅 طلب حجز جديد';
    body_str := format('%s حجز %s دقيقة في %s',
                       coalesce(new.service_title, 'خدمة'), new.duration_minutes, dt_str);
    the_link := '/dashboard/bookings?focus=' || new.id;
    target_id := new.seller_id;

  elsif new.status = 'confirmed' and old.status <> 'confirmed' then
    title_str := '✅ تم تأكيد حجزك';
    body_str := format('الحجز بتاريخ %s تم تأكيده من البائع.', dt_str);
    the_link := '/my/bookings?focus=' || new.id;
    target_id := new.buyer_id;

  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    cancelled_by_buyer := (coalesce(new.cancelled_by, new.buyer_id) = new.buyer_id);
    title_str := '⛔ تم إلغاء موعد حجز';
    body_str := format('الحجز بتاريخ %s أُلغي. %s', dt_str, coalesce(new.cancel_reason, ''));
    -- يُبلَّغ الطرف الآخر، لا من ألغى
    target_id := case when cancelled_by_buyer then new.seller_id else new.buyer_id end;
    the_link := case when cancelled_by_buyer
                     then '/dashboard/bookings?focus=' || new.id
                     else '/my/bookings?focus=' || new.id end;

  elsif new.status = 'completed' and old.status <> 'completed' then
    title_str := '🎉 اكتمل موعدك';
    body_str := format('موعد %s اكتمل. قيّم تجربتك مع البائع.', dt_str);
    the_link := '/my/bookings?focus=' || new.id;
    target_id := new.buyer_id;

  else
    return new;
  end if;

  -- الإشعار تحسين لا شرط: فشله ما يرجّع الحجز نفسه
  begin
    perform notify(target_id, 'booking_update', title_str, left(body_str, 200), the_link);
  exception when others then null; end;

  return new;
end; $$;

drop trigger if exists bookings_notify_trigger on seller_bookings;
create trigger bookings_notify_trigger after insert or update on seller_bookings
  for each row execute function bookings_notify();

-- deals.scheduled_at قد لا يكون موجودًا حسب ترتيب التطبيق
alter table deals add column if not exists scheduled_at timestamptz;
grant update (scheduled_at) on deals to authenticated;
