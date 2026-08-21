-- ============================================================
-- الموقع الجغرافي للبائع + دليل الزلفي على الخريطة
-- ============================================================
--
-- TECH.md نصّ على latitude/longitude ضمن أعمدة listings من البداية، لكنها ما
-- أُضيفت إطلاقًا — ما فيه ولا إشارة جغرافية واحدة بالمشروع كله. وصاحب المشروع
-- طلبها صراحة: "أبي أحط خدمات مثل قوقل ماب، أرقام المحلات، يصير مرجع للزلفي".
--
-- الموقع على `sellers` لا `listings`: المحل واحد وله موقع واحد، بينما إعلاناته
-- عشرات. هذا يمنع تكرار نفس الإحداثيات بكل صف ويجعل التحديث بمكان واحد.
--
-- بدون PostGIS عمدًا: الاستخدام الحالي هو العرض والاتجاهات فقط، لا بحث بمسافة.
-- عمودان numeric يكفيان، وPostGIS يُضاف لاحقًا لو احتجنا "الأقرب لي" فعليًا
-- (مبدأ التكلفة بـTECH.md — لا نبني تعقيدًا قبل ما يثبت أنه لازم).

alter table sellers add column if not exists latitude  numeric(9, 6);
alter table sellers add column if not exists longitude numeric(9, 6);
alter table sellers add column if not exists address_note text;
alter table sellers add column if not exists phone text;
alter table sellers add column if not exists neighborhood_id int references neighborhoods(id);

-- حدود الزلفي التقريبية بهامش واسع (26.2°-26.5° شمالاً، 44.6°-44.9° شرقاً).
-- الغرض منع خطأ شائع: لصق إحداثيات معكوسة (خط الطول مكان العرض) أو من مدينة
-- ثانية — لا "التحقق الأمني". نبقيها واسعة عشان ما نرفض موقعًا صحيحًا بالأطراف.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sellers_coords_valid') then
    alter table sellers add constraint sellers_coords_valid check (
      (latitude is null and longitude is null)
      or (latitude between -90 and 90 and longitude between -180 and 180)
    );
  end if;
end $$;

-- فهرس جزئي: صفحة الخريطة تجلب البائعين المعتمدين اللي عندهم موقع فقط.
create index if not exists sellers_located_idx
  on sellers (verification_status)
  where latitude is not null and longitude is not null;

create index if not exists sellers_neighborhood_idx on sellers (neighborhood_id);

-- ============================================================
-- تتبع نقرة التواصل على مستوى البائع
-- ============================================================
--
-- record_contact_click() موجودة لكنها مربوطة بإعلان. زر واتساب بصفحة البائع
-- (app/seller/[slug]/page.tsx) وزر "اتصال" بالخريطة ما لهما إعلان، فكانا بلا
-- تتبع إطلاقًا — وإحصائيات "كم عميل جبنا لك" هي حجّة البيع الأساسية للبائع.

create table if not exists seller_contact_clicks (
  id bigserial primary key,
  seller_id uuid references sellers(id) on delete cascade not null,
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp', 'phone', 'directions', 'profile')),
  visitor_hash text,
  clicked_at timestamptz not null default now()
);

create index if not exists seller_contact_clicks_idx
  on seller_contact_clicks (seller_id, clicked_at desc);

alter table seller_contact_clicks enable row level security;

-- البائع يشوف نقراته هو فقط؛ الكتابة تتم عبر الدالة أدناه لا مباشرة.
drop policy if exists "seller reads own contact clicks" on seller_contact_clicks;
create policy "seller reads own contact clicks"
  on seller_contact_clicks for select using (seller_id = auth.uid() or is_admin());

revoke insert, update, delete on seller_contact_clicks from anon, authenticated;

-- نفس هدف record_contact_click (منع نفخ العدّاد بطلبات متكررة) لكن بدون
-- interaction_log: جدولها مربوط بـlisting_id NOT NULL فما يقبل صف بلا إعلان.
-- الجدول هنا يعمل كسجل ودالة إزالة التكرار بنفس الوقت — نافذة ساعة لكل
-- (زائر، بائع، قناة). وتجاهل صامت للبائع غير المعتمد.
create or replace function record_seller_contact_click(
  p_seller_id uuid,
  p_channel text default 'whatsapp',
  p_visitor_hash text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_channel not in ('whatsapp', 'phone', 'directions', 'profile') then
    return;
  end if;

  if not exists (
    select 1 from sellers
     where id = p_seller_id and verification_status = 'approved'
  ) then
    return;
  end if;

  if p_visitor_hash is not null and exists (
    select 1 from seller_contact_clicks
     where seller_id = p_seller_id
       and channel = p_channel
       and visitor_hash = p_visitor_hash
       and clicked_at > now() - interval '1 hour'
  ) then
    return;
  end if;

  insert into seller_contact_clicks (seller_id, channel, visitor_hash)
  values (p_seller_id, p_channel, p_visitor_hash);
end $$;

grant execute on function record_seller_contact_click(uuid, text, text) to anon, authenticated;

-- ============================================================
-- دليل الخريطة — استعلام واحد بدل N+1
-- ============================================================
--
-- صفحة /map تحتاج: البائع + حيّه + عدد إعلاناته المنشورة + فئته الغالبة.
-- بدون هذي الدالة كانت أربعة استعلامات لكل بائع (تحذير GLM بـTECH.md §N+1).

create or replace function map_directory(p_neighborhood_id int default null)
returns table (
  id uuid,
  business_name text,
  slug text,
  business_type text,
  description text,
  logo_url text,
  whatsapp_number text,
  phone text,
  latitude numeric,
  longitude numeric,
  address_note text,
  neighborhood_id int,
  neighborhood_name text,
  listing_count bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    s.id, s.business_name, s.slug, s.business_type, s.description,
    s.logo_url, s.whatsapp_number, s.phone,
    s.latitude, s.longitude, s.address_note,
    s.neighborhood_id, n.name_ar as neighborhood_name,
    count(l.id) filter (where l.status = 'published') as listing_count
  from sellers s
  left join neighborhoods n on n.id = s.neighborhood_id
  left join listings l on l.seller_id = s.id
  where s.verification_status = 'approved'
    and (p_neighborhood_id is null or s.neighborhood_id = p_neighborhood_id)
  group by s.id, n.name_ar
  order by (s.latitude is null), count(l.id) filter (where l.status = 'published') desc,
           s.business_name;
$$;

grant execute on function map_directory(int) to anon, authenticated;

-- ============================================================
-- إحصائيات الموقع للوحة البائع
-- ============================================================

create or replace function seller_contact_summary(p_days int default 30)
returns table (channel text, clicks bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.channel, count(*)::bigint
    from seller_contact_clicks c
   where c.seller_id = auth.uid()
     and c.clicked_at > now() - make_interval(days => p_days)
   group by c.channel
   order by count(*) desc;
$$;

grant execute on function seller_contact_summary(int) to authenticated;
