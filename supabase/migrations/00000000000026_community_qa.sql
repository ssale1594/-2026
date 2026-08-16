-- "اسأل أهل الزلفي" (community Q&A) — PLAN.md §11.2 and §20.24. The question
-- "مين يعرف كهربائي زين؟" is the single most common thing asked in local
-- WhatsApp groups, and every answer to it is a recommendation that should point
-- at a real seller page instead of evaporating in a chat thread.
--
-- Asking requires a signed-in account (buyer profiles exist as of migration 23):
-- an anonymous public Q&A board in a small town is a moderation problem, and
-- the whole value here is that answers come from identifiable neighbours.

create table if not exists questions (
  id bigserial primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  body text,
  category_id int references categories(id),
  neighborhood_id int references neighborhoods(id),
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  answer_count int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_questions_live
  on questions (status, created_at desc);

create table if not exists answers (
  id bigserial primary key,
  question_id bigint references questions(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  -- The point of the whole feature: an answer can name a seller on the
  -- platform, turning a chat-style recommendation into a real link.
  recommended_seller_id uuid references sellers(id) on delete set null,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz default now()
);

create index if not exists idx_answers_question on answers (question_id, created_at);

alter table questions enable row level security;
alter table answers enable row level security;

drop policy if exists "questions_select_public" on questions;
create policy "questions_select_public" on questions for select using (
  status = 'published'
);

drop policy if exists "questions_insert_own" on questions;
create policy "questions_insert_own" on questions for insert with check (
  author_id = auth.uid() and status = 'published'
);

-- Hiding is a moderation action; a user editing their own question must not be
-- able to flip status back after an admin hides it.
revoke update (status, author_id, answer_count) on questions from authenticated;

drop policy if exists "questions_update_own" on questions;
create policy "questions_update_own" on questions for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "admin_all_questions" on questions;
create policy "admin_all_questions" on questions for all using (is_admin());

drop policy if exists "answers_select_public" on answers;
create policy "answers_select_public" on answers for select using (
  status = 'published'
);

drop policy if exists "answers_insert_own" on answers;
create policy "answers_insert_own" on answers for insert with check (
  author_id = auth.uid()
  and status = 'published'
  and exists (
    select 1 from questions q
    where q.id = question_id and q.status = 'published'
  )
);

revoke update (status, author_id, question_id) on answers from authenticated;

drop policy if exists "answers_update_own" on answers;
create policy "answers_update_own" on answers for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "admin_all_answers" on answers;
create policy "admin_all_answers" on answers for all using (is_admin());

-- Keep questions.answer_count in sync, the same denormalization pattern the
-- initial schema uses for sellers.active_listings_count.
create or replace function update_question_answer_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' and new.status = 'published' then
    update questions set answer_count = answer_count + 1 where id = new.question_id;
  elsif tg_op = 'DELETE' and old.status = 'published' then
    update questions set answer_count = answer_count - 1 where id = old.question_id;
  elsif tg_op = 'UPDATE' and old.status = 'published' and new.status <> 'published' then
    update questions set answer_count = answer_count - 1 where id = new.question_id;
  elsif tg_op = 'UPDATE' and old.status <> 'published' and new.status = 'published' then
    update questions set answer_count = answer_count + 1 where id = new.question_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_answer_count on answers;
create trigger trg_answer_count
  after insert or update or delete on answers
  for each row execute function update_question_answer_count();
