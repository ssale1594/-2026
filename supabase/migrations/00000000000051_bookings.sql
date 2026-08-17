-- ============================================================
-- نظام الحجوزات (Bookings) للخدمات — دوام البائع الأسبوعي + الحجوزات
-- ============================================================

create table if not exists seller_availability (
  id bigserial primary key,
  seller_id uuid not null references profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=الأحد، 6=السبت
  start_minute smallint not null check (start_minute between 0 and 1439), -- 0 = 00:00
  end_minute smallint not null check (end_minute between 0 and 1439),
  is_closed boolean not null default false,
  slot_duration_minutes smallint not null default 60 check (slot_duration_minutes in (15, 30, 45, 60, 90, 120)),
  buffer_minutes smallint not null default 0 check (buffer_minutes between 0 and 240),
  max_parallel_bookings smallint not null default 1 check (max_parallel_bookings between 1 and 20),
  created_at timestamptz not null default now(),
  unique (seller_id, day_of_week)
);

create index if not exists sched_seller_idx on seller_availability(seller_id);
alter table seller_availability enable row level security;

drop policy if exists "seller_av seller read own" on seller_availability;
create policy "seller_av seller read own"
  on seller_availability for select using (seller_id = auth.uid());
drop policy if exists "seller_av public read approved" on seller_availability;
create policy "seller_av public read approved"
  on seller_availability for select using (true); -- للعامة يرون الدوام فقط عند الحجز
drop policy if exists "seller_av seller manage own" on seller_availability;
create policy "seller_av seller manage own"
  on seller_availability for all with check (seller_id = auth.uid());
grant select, insert, update, delete on seller_availability to authenticated;

create table if not exists seller_bookings (
  id bigserial primary key,
  seller_id uuid not null references profiles(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  deal_id bigint references deals(id) on delete set null,
  booking_date date not null,
  start_minute smallint not null,
  duration_minutes smallint not null check (duration_minutes between 15 and 480),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  customer_name text,
  customer_phone text,
  service_title text,
  quoted_price_sar numeric(12,2) check (quoted_price_sar is null or quoted_price_sar > 0),
  notes text check (char_length(coalesce(notes, '')) <= 500),
  cancel_reason text check (char_length(coalesce(cancel_reason, '')) <= 300),
  cancelled_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- لا يسمح بحجزين متداخلين لنفس البائع إذا كان الحالة not cancelled
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
    and status = 'pending'
    and booking_date >= current_date
    and duration_minutes in (15, 30, 45, 60, 90, 120)
    and char_length(coalesce(notes, '')) <= 500
  );

drop policy if exists "bookings buyer cancels pending only" on seller_bookings;
create policy "bookings buyer cancels pending only"
  on seller_bookings for update using (buyer_id = auth.uid()) with check (
    buyer_id = auth.uid()
    and old.status = 'pending' and new.status = 'cancelled'
    and seller_id = old.seller_id and buyer_id = old.buyer_id
    and booking_date = old.booking_date
  );

drop policy if exists "bookings seller manage" on seller_bookings;
create policy "bookings seller manage"
  on seller_bookings for update using (seller_id = auth.uid()) with check (
    seller_id = auth.uid()
    and (
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or
      (old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'no_show'))
    )
    and buyer_id = old.buyer_id and booking_date = old.booking_date
  );

grant select, insert, update on seller_bookings to authenticated;

create or replace function seller_bookings_set_ts() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'confirmed' and old.status <> 'confirmed' then new.confirmed_at := now(); end if;
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at := now(); end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then new.cancelled_at := now(); end if;
  return new;
end; $$;
drop trigger if exists seller_bookings_ts_trigger on seller_bookings;
create trigger seller_bookings_ts_trigger before update on seller_bookings
  for each row execute function seller_bookings_set_ts();

-- دالة: توليد فترات فارغة (الأيام الـ N القادمة) لصفحة الحجز
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
  slot_dur integer := 60;
  buff integer := 0;
  max_parallel integer := 1;
  v_avail boolean;
  v_count bigint;
begin
  for day_cursor in
    select p_start_date + generate_series(0, greatest(1, least(p_days, 60)) - 1) loop
      select * into v_sched
      from seller_availability s
      where s.seller_id = p_seller_id
        and s.day_of_week = extract(isodow from day_cursor)::int % 7;

      if not found or v_sched.is_closed then
        -- يوم مغلق كامل -> لا نعيد شيئاً
        continue;
      end if;

      slot_dur := coalesce(v_sched.slot_duration_minutes, 60);
      buff := coalesce(v_sched.buffer_minutes, 0);
      max_parallel := coalesce(v_sched.max_parallel_bookings, 1);

      cur_start := v_sched.start_minute;
      while cur_start + slot_dur <= v_sched.end_minute loop
        cur_end := cur_start + slot_dur;

        -- حساب عدد الحجوزات المتداخلة مع هذا الفترة (مع مراعاة buffer أيضاً)
        select coalesce(count(*), 0) into v_count
          from seller_bookings b
         where b.seller_id = p_seller_id
           and b.status <> 'cancelled'
           and b.booking_date = day_cursor
           and int4range(b.start_minute - buff, b.start_minute + b.duration_minutes + buff, '[)')
               && int4range(cur_start, cur_end, '[)');

        v_avail := (v_count < max_parallel);
        return query values (day_cursor, cur_start::smallint, cur_end::smallint, v_avail, v_count);
        cur_start := cur_start + slot_dur;
      end loop;
    end loop;
  return;
end; $$;
grant execute on function seller_free_slots(uuid, date, int) to anon, authenticated;

-- Trigger: عند تأكيد الحجز (confirmed) ننشئ صفقة Deal تلقائية إن لم تكن موجودة
create or replace function booking_confirmed_create_deal() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  new_deal_id bigint;
  d_title text;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if old.status <> 'pending' or new.status <> 'confirmed' then return new; end if;
  if new.deal_id is not null then return new; end if;

  d_title := format('حجز موعد: %s - %s',
    new.service_title ?? 'حجز خدمة',
    to_char(new.booking_date, 'DD/MM/YYYY'));

  insert into deals (seller_id, buyer_id, listing_id, title, description, price_agreed_sar, status, scheduled_at)
    values (new.seller_id, new.buyer_id, new.listing_id, d_title,
            format('حجز في %s:%s لمدة %s دقيقة. ملاحظة: %s',
              lpad(((new.start_minute / 60))::text, 2, '0') || ':' ||
                lpad(((new.start_minute % 60))::text, 2, '0'),
              lpad((((new.start_minute + new.duration_minutes) / 60))::text, 2, '0') || ':' ||
                lpad((((new.start_minute + new.duration_minutes) % 60))::text, 2, '0'),
              new.duration_minutes,
              coalesce(new.notes, '—')),
            new.quoted_price_sar,
            'accepted',
            make_timestamptz(
              extract(year from new.booking_date)::int,
              extract(month from new.booking_date)::int,
              extract(day from new.booking_date)::int,
              (new.start_minute / 60)::int,
              (new.start_minute % 60)::int,
              0
            )
           )
    returning id into new_deal_id;

  new.deal_id := new_deal_id;
  return new;
end; $$;
drop trigger if exists booking_confirmed_deal_trigger on seller_bookings;
create trigger booking_confirmed_deal_trigger before update on seller_bookings
  for each row execute function booking_confirmed_create_deal();

-- إشعارات طرفي الحجز
create or replace function bookings_notify() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  other_id uuid;
  is_buyer boolean := (tg_op = 'INSERT') or (tg_op = 'UPDATE' and new.cancelled_by = new.buyer_id);
  title_str text;
  body_str text;
  the_link text;
  dt_str text;
begin
  if tg_op = 'INSERT' then
    -- للبائع: طلب حجز جديد
    title_str := '📅 طلب حجز جديد';
    dt_str := to_char(new.booking_date, 'DD/MM/YYYY') || ' الساعة ' || lpad(((new.start_minute / 60))::text, 2, '0') || ':' || lpad(((new.start_minute % 60))::text, 2, '0');
    body_str := format('%s حجز %s دقيقة في %s', new.service_title ?? 'خدمة', new.duration_minutes, dt_str);
    the_link := '/dashboard/bookings?focus=' || new.id;
    other_id := new.seller_id;
  elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status <> 'confirmed' then
    -- للمشتري: تأكيد الحجز
    title_str := '✅ تم تأكيد حجزك';
    dt_str := to_char(new.booking_date, 'DD/MM/YYYY') || ' الساعة ' || lpad(((new.start_minute / 60))::text, 2, '0') || ':' || lpad(((new.start_minute % 60))::text, 2, '0');
    body_str := format('الحجز بتاريخ %s تم تأكيده من البائع.', dt_str);
    other_id := new.buyer_id;
    the_link := '/my/bookings?focus=' || new.id;
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status <> 'cancelled' then
    -- للطرف الآخر (إلغاء الحجز)
    is_buyer := (coalesce(new.cancelled_by, new.buyer_id) = new.buyer_id);
    title_str := '⛔ تم إلغاء موعد حجز';
    body_str := format('الحجز بتاريخ %s أُلغي. %s', to_char(new.booking_date, 'DD/MM/YYYY'), coalesce(new.cancel_reason, ''));
    other_id := case when is_buyer then new.seller_id else new.buyer_id end;
    the_link := case when is_buyer then '/dashboard/bookings?focus=' || new.id else '/my/bookings?focus=' || new.id end;
  else
    return new;
  end if;
  begin
    perform notify(other_id, 'booking_update', title_str, left(body_str, 200), the_link);
  exception when others then null; end;
  return new;
end; $$;

drop trigger if exists bookings_notify_trigger on seller_bookings;
create trigger bookings_notify_trigger after insert or update on seller_bookings
  for each row execute function bookings_notify();

-- تأكد من أن scheduled_at موجود في deals (قد يكون موجوداً أو لا)
do $$ begin
  alter table deals add column if not exists scheduled_at timestamptz;
exception when others then null; end; $$;
