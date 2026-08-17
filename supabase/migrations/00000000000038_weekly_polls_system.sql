-- ============================================================
-- نظام الاستفتاءات الأسبوعية (أفضل بائع الأسبوع)
-- ============================================================

create table if not exists polls (
  id bigserial primary key,
  title text not null,
  description text,
  week_start_date date not null,
  week_end_date date not null,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  winner_seller_id uuid references sellers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists polls_status_idx on polls(status);
create index if not exists polls_week_idx on polls(week_start_date desc, week_end_date desc);

create table if not exists poll_options (
  id bigserial primary key,
  poll_id bigint not null references polls(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(poll_id, seller_id)
);

create index if not exists poll_options_poll_idx on poll_options(poll_id);

create table if not exists poll_votes (
  id bigserial primary key,
  poll_id bigint not null references polls(id) on delete cascade,
  option_id bigint not null references poll_options(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  voted_at timestamptz not null default now(),
  unique(poll_id, voter_id)
);

create index if not exists poll_votes_opt_idx on poll_votes(option_id);
create index if not exists poll_votes_voter_idx on poll_votes(voter_id);

-- RLS
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

drop policy if exists "polls are visible to all authenticated" on polls;
create policy "polls are visible to all authenticated"
  on polls for select using (auth.role() = 'authenticated' and (status <> 'draft'));

drop policy if exists "poll options are visible" on poll_options;
create policy "poll options are visible"
  on poll_options for select using (exists (select 1 from polls p where p.id = poll_id and auth.role() = 'authenticated'));

drop policy if exists "users can see own votes" on poll_votes;
create policy "users can see own votes"
  on poll_votes for select using (voter_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "users can insert one vote per poll" on poll_votes;
create policy "users can insert one vote per poll"
  on poll_votes for insert with check (
    voter_id = auth.uid() and
    exists (select 1 from polls p where p.id = poll_id and p.status = 'active') and
    not exists (select 1 from poll_votes pv where pv.poll_id = poll_votes.poll_id and pv.voter_id = auth.uid())
  );

-- دالة: إنهاء الاستفتاء وتحديث الفائز + شارة الفائز على البائع
create or replace function close_poll_and_set_winner(p_poll_id bigint)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_winner uuid;
  v_winner_votes bigint;
  v_out jsonb;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- حساب الأكثر أصواتاً
  select o.seller_id, count(v.id)
    into v_winner, v_winner_votes
  from poll_options o
  left join poll_votes v on v.option_id = o.id
  where o.poll_id = p_poll_id
  group by o.id, o.seller_id
  order by count(v.id) desc, o.id asc
  limit 1;

  -- تحديث الاستفتاء
  update polls set status = 'closed', winner_seller_id = v_winner, updated_at = now() where id = p_poll_id;

  -- إضافة بادج الفائز للبائع (لو العمود موجود)
  if v_winner is not null and exists (
    select 1 from information_schema.columns where table_name='profiles' and column_name='winner_badge_count'
  ) then
    update profiles set winner_badge_count = coalesce(winner_badge_count, 0) + 1 where id = v_winner;
  elsif v_winner is not null then
    raise notice 'profiles.winner_badge_count column not found — skipping badge increment';
  end if;

  v_out := jsonb_build_object(
    'poll_id', p_poll_id,
    'winner_seller_id', v_winner,
    'votes', v_winner_votes
  );
  return v_out;
end; $$;

revoke all on function close_poll_and_set_winner(bigint) from anon, authenticated;
grant execute on function close_poll_and_set_winner(bigint) to service_role;

-- دالة: الحصول على نتائج استفتاء
create or replace function poll_results(p_poll_id bigint)
returns table (
  option_id bigint,
  seller_id uuid,
  seller_name text,
  seller_slug text,
  votes_count bigint,
  percent_of_total float4
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_total bigint;
begin
  select count(*) into v_total from poll_votes where poll_id = p_poll_id;
  return query
  select
    o.id as option_id,
    o.seller_id,
    coalesce(p.business_name, p.full_name, p.id::text)::text as seller_name,
    p.slug as seller_slug,
    count(v.id)::bigint as votes_count,
    case when v_total > 0 then (count(v.id)::float4 / v_total::float4) * 100 else 0 end as percent_of_total
  from poll_options o
  left join poll_votes v on v.option_id = o.id
  left join profiles p on p.id = o.seller_id
  where o.poll_id = p_poll_id
  group by o.id, o.seller_id, p.business_name, p.full_name, p.slug
  order by votes_count desc, o.sort_order asc, o.id asc;
end; $$;

grant execute on function poll_results(bigint) to authenticated;

-- دالة: الاستفتاء النشط الحالي (عرض للزوار)
create or replace function get_active_poll()
returns table (
  id bigint,
  title text,
  description text,
  week_start_date date,
  week_end_date date,
  status text,
  total_votes bigint,
  my_vote_option_id bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with current_poll as (
    select p.id, p.title, p.description, p.week_start_date, p.week_end_date, p.status
    from polls p
    where p.status = 'active'
    order by p.week_start_date desc
    limit 1
  )
  select
    cp.id, cp.title, cp.description, cp.week_start_date, cp.week_end_date, cp.status,
    (select count(*) from poll_votes v where v.poll_id = cp.id)::bigint as total_votes,
    (select v.option_id from poll_votes v where v.poll_id = cp.id and v.voter_id = auth.uid() limit 1) as my_vote_option_id
  from current_poll cp;
end; $$;

grant execute on function get_active_poll() to authenticated;

-- زر الإدمن: إنشاء استفتاء أسبوعي تلقائي (السبوع الحالي)
create or replace function admin_create_weekly_poll(
  p_title text default 'من هو أفضل بائع في الزلفي هذا الأسبوع؟',
  p_description text default 'صوّت لبائعك المفضل الذي زوّنك بالمنتج والخدمة الممتازة هذا الأسبوع. نتائج الاستفتاء تظهر صباح يوم السبت.'
)
returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_start date;
  v_end date;
  v_id bigint;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- تبدأ الأحد = بداية الأسبوع في التقويم الإسلامي/السعودي; نختار الأحد القادم أو الحالي
  v_start := date_trunc('week', now()::date + interval '1 day')::date - interval '1 day'; -- Sunday of current week
  v_end := v_start + interval '6 days'; -- الصباح التالي للسبت = بعد 6 أيام من الأحد

  insert into polls (title, description, week_start_date, week_end_date, status)
  values (p_title, p_description, v_start, v_end, 'draft')
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function admin_create_weekly_poll(text,text) from anon, authenticated;
grant execute on function admin_create_weekly_poll(text,text) to service_role;
