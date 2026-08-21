-- رحلات الاحتياج (need journeys) — PLAN.md §20.38-41 / ROADMAP phase 3.
-- A journey groups the many things one life event actually requires (a wedding
-- needs a hall, a photographer, catering, flowers...) into one page, so the
-- user browses by *their need* rather than by our commercial categories.
--
-- Steps deliberately carry a search_query rather than only a category_id: the
-- platform has just 5 broad categories, so "مصور" and "قاعة أفراح" both live
-- under خدمات/محلات and can only be separated by the Arabic-normalized search
-- that already exists (search_listings in migration 6).

create table if not exists journeys (
  id serial primary key,
  name_ar text not null,
  slug text unique not null,
  description text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists journey_steps (
  id serial primary key,
  journey_id int references journeys(id) on delete cascade not null,
  title_ar text not null,
  search_query text,
  category_id int references categories(id),
  sort_order int default 0
);

create index if not exists idx_journey_steps_journey on journey_steps (journey_id, sort_order);

alter table journeys enable row level security;
alter table journey_steps enable row level security;

-- Public reference data, same shape as categories/neighborhoods (migration 12).
drop policy if exists "journeys_select_public" on journeys;
create policy "journeys_select_public" on journeys for select using (true);

drop policy if exists "journey_steps_select_public" on journey_steps;
create policy "journey_steps_select_public" on journey_steps for select using (true);

-- Seed the four journeys ChatGPT's brainstorm called out by name (PLAN.md §20.38-41).
insert into journeys (name_ar, slug, description, sort_order) values
  ('أجهز زواجي', 'wedding', 'كل اللي تحتاجه لترتيب زواجك بالزلفي بمكان واحد.', 1),
  ('بيتي الجديد', 'new-home', 'من النقل والتنظيف للأثاث والصيانة — ترتيب بيتك الجديد خطوة خطوة.', 2),
  ('مولود جديد', 'newborn', 'تصوير وتوزيعات وحلويات وهدايا لاستقبال مولودك.', 3),
  ('العودة للمدارس', 'back-to-school', 'مدرسين وقرطاسية وحقائب وكل مستلزمات العام الدراسي.', 4)
on conflict (slug) do nothing;

-- Steps are seeded once per journey; the "not exists" guard keeps this
-- idempotent without needing a unique constraint on free-text titles.
do $$
declare
  v_wedding int;
  v_new_home int;
  v_newborn int;
  v_school int;
  v_services int;
  v_shops int;
  v_home_producers int;
  v_real_estate int;
begin
  select id into v_wedding from journeys where slug = 'wedding';
  select id into v_new_home from journeys where slug = 'new-home';
  select id into v_newborn from journeys where slug = 'newborn';
  select id into v_school from journeys where slug = 'back-to-school';

  select id into v_services from categories where slug = 'services';
  select id into v_shops from categories where slug = 'shops';
  select id into v_home_producers from categories where slug = 'home-producers';
  select id into v_real_estate from categories where slug = 'real-estate';

  if not exists (select 1 from journey_steps where journey_id = v_wedding) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_wedding, 'قاعة أفراح', 'قاعة', v_services, 1),
      (v_wedding, 'تصوير', 'تصوير', v_services, 2),
      (v_wedding, 'ضيافة وقهوة', 'ضيافة', v_services, 3),
      (v_wedding, 'حلويات وكيك', 'حلى', v_home_producers, 4),
      (v_wedding, 'ورد وتنسيق', 'ورد', v_shops, 5),
      (v_wedding, 'كوش وديكور', 'كوشة', v_services, 6),
      (v_wedding, 'دعوات ومطبوعات', 'دعوات', v_shops, 7),
      (v_wedding, 'تجميل وكوافير', 'كوافير', v_services, 8);
  end if;

  if not exists (select 1 from journey_steps where journey_id = v_new_home) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_new_home, 'سكن للإيجار', 'شقة', v_real_estate, 1),
      (v_new_home, 'نقل عفش', 'نقل', v_services, 2),
      (v_new_home, 'تنظيف', 'تنظيف', v_services, 3),
      (v_new_home, 'تكييف', 'تكييف', v_services, 4),
      (v_new_home, 'كهرباء وسباكة', 'سباك', v_services, 5),
      (v_new_home, 'ستائر وسجاد', 'ستائر', v_shops, 6),
      (v_new_home, 'أثاث', 'أثاث', v_shops, 7);
  end if;

  if not exists (select 1 from journey_steps where journey_id = v_newborn) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_newborn, 'تصوير مواليد', 'تصوير', v_services, 1),
      (v_newborn, 'توزيعات', 'توزيعات', v_home_producers, 2),
      (v_newborn, 'حلويات', 'حلى', v_home_producers, 3),
      (v_newborn, 'هدايا', 'هدايا', v_shops, 4),
      (v_newborn, 'مستلزمات أطفال', 'أطفال', v_shops, 5);
  end if;

  if not exists (select 1 from journey_steps where journey_id = v_school) then
    insert into journey_steps (journey_id, title_ar, search_query, category_id, sort_order) values
      (v_school, 'مدرسين خصوصي', 'مدرس', v_services, 1),
      (v_school, 'قرطاسية', 'قرطاسية', v_shops, 2),
      (v_school, 'حقائب مدرسية', 'حقيبة', v_shops, 3),
      (v_school, 'زي مدرسي', 'زي', v_shops, 4),
      (v_school, 'وجبات ومقاضي', 'وجبات', v_home_producers, 5);
  end if;
end $$;
