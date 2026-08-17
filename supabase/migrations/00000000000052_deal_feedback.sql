-- ============================================================
-- استبيان رضا العملاء + تقييم نجوم بعد الصفقة
-- ============================================================
--
-- المشروع فيه أصلاً جدول reviews (هجرة 23) مربوط بـtransactions — نظام
-- المطالبة اليدوي القديم. هذا الجدول مربوط بـdeals (هجرة 42) وهي دورة
-- حياة مختلفة. عمدًا ما دمجناهما في جدول واحد: مفتاح المصدر مختلف
-- والقيود مختلفة. لكن `seller_rating` أدناه أُعيدت كتابتها لتجمع
-- المصدرين، حتى لا ينتهي البائع بتقييمين متنافسين في مكانين.

create table if not exists deal_feedback (
  id bigserial primary key,
  deal_id bigint not null unique references deals(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade, -- المشتري
  reviewee_id uuid not null references sellers(id) on delete cascade, -- البائع
  rating_stars smallint not null check (rating_stars between 1 and 5),
  would_recommend boolean not null default true,
  comment text check (char_length(coalesce(comment, '')) <= 600),
  created_at timestamptz not null default now(),
  check (reviewer_id <> reviewee_id)
);

create index if not exists deal_feedback_reviewee_idx
  on deal_feedback(reviewee_id, created_at desc);

alter table deal_feedback enable row level security;

-- التقييمات عامة: كارت البائع في البحث وصفحته يعرضانها.
drop policy if exists "deal_feedback public read" on deal_feedback;
create policy "deal_feedback public read" on deal_feedback for select using (true);

-- الشرط الحاسم: لا يقيّم إلا مشتري تلك الصفقة بالذات، وبعد اكتمالها.
-- القيد `unique (deal_id)` يتكفّل بـ"مرة واحدة فقط" — لا نعتمد على فحص
-- بالتطبيق يمكن تجاوزه بطلبين متزامنين.
drop policy if exists "deal_feedback buyer inserts once" on deal_feedback;
create policy "deal_feedback buyer inserts once"
  on deal_feedback for insert with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from deals d
       where d.id = deal_feedback.deal_id
         and d.buyer_id = auth.uid()
         and d.seller_id = deal_feedback.reviewee_id
         and d.status in ('buyer_confirmed', 'completed')
    )
  );

-- لا تعديل ولا حذف بعد الإرسال: تقييم قابل للتحرير بأثر رجعي ليس تقييمًا.
-- (الإدارة تتصرف عبر is_admin أدناه.)
drop policy if exists "deal_feedback admin all" on deal_feedback;
create policy "deal_feedback admin all" on deal_feedback for all using (is_admin());

grant select on deal_feedback to anon, authenticated;
grant insert on deal_feedback to authenticated;

-- ============================================================
-- متوسط تقييم البائع — يجمع reviews (23) و deal_feedback (هنا)
-- ============================================================
-- آمنة للنشر: لا ترجّع إلا تجميعات على تقييمات عامة أصلاً.
create or replace function seller_rating(p_seller_id uuid)
returns table (average numeric, total bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with all_ratings as (
    select rating::numeric as stars from reviews where seller_id = p_seller_id
    union all
    select rating_stars::numeric from deal_feedback where reviewee_id = p_seller_id
  )
  select round(avg(stars), 1), count(*) from all_ratings;
$$;
grant execute on function seller_rating(uuid) to anon, authenticated;

-- نسبة من يوصون بالبائع — تُعرض بجانب النجوم لأن "٤.٨" وحدها لا تقول
-- هل يعاود العميل التعامل أم لا.
create or replace function seller_recommend_rate(p_seller_id uuid)
returns table (recommend_pct int, sample_size bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    case when count(*) = 0 then null
         else round(100.0 * count(*) filter (where would_recommend) / count(*))::int
    end,
    count(*)
  from deal_feedback
  where reviewee_id = p_seller_id;
$$;
grant execute on function seller_recommend_rate(uuid) to anon, authenticated;

-- آخر التقييمات لعرضها في صفحة البائع
create or replace function seller_recent_feedback(p_seller_id uuid, p_limit int default 20)
returns table (
  id bigint,
  rating_stars smallint,
  would_recommend boolean,
  comment text,
  reviewer_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select f.id, f.rating_stars, f.would_recommend, f.comment,
         coalesce(p.full_name, 'عميل'), f.created_at
    from deal_feedback f
    left join profiles p on p.id = f.reviewer_id
   where f.reviewee_id = p_seller_id
   order by f.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;
grant execute on function seller_recent_feedback(uuid, int) to anon, authenticated;

-- هل يحق للمستخدم الحالي تقييم هذه الصفقة؟ نفس شرط سياسة الإدراج،
-- معروضًا للواجهة حتى لا تظهر نموذجًا سيُرفض.
create or replace function can_review_deal(p_deal_id bigint)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from deals d
     where d.id = p_deal_id
       and d.buyer_id = auth.uid()
       and d.status in ('buyer_confirmed', 'completed')
       and not exists (select 1 from deal_feedback f where f.deal_id = d.id)
  );
$$;
grant execute on function can_review_deal(bigint) to authenticated;

-- ============================================================
-- عند اكتمال الصفقة: ادعُ المشتري للتقييم
-- ============================================================
create or replace function deal_completed_ask_feedback() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status not in ('buyer_confirmed', 'completed') then return new; end if;
  if old.status in ('buyer_confirmed', 'completed') then return new; end if;
  if exists (select 1 from deal_feedback f where f.deal_id = new.id) then return new; end if;

  begin
    perform notify(
      new.buyer_id,
      'deal_feedback_request',
      '⭐ قيّم تجربتك',
      left(format('كيف كانت تجربتك في «%s»؟ ٣٠ ثانية فقط.',
                  coalesce(new.title, 'الصفقة')), 200),
      '/my/deals?review=' || new.id
    );
  exception when others then null; end;

  return new;
end; $$;

drop trigger if exists deal_completed_feedback_trigger on deals;
create trigger deal_completed_feedback_trigger after update on deals
  for each row execute function deal_completed_ask_feedback();

-- إشعار البائع بوصول تقييم جديد
create or replace function deal_feedback_notify_seller() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    perform notify(
      new.reviewee_id,
      'deal_feedback_received',
      format('%s وصلك تقييم جديد', repeat('⭐', new.rating_stars)),
      left(coalesce(nullif(trim(new.comment), ''), 'بدون تعليق'), 200),
      '/dashboard/deals'
    );
  exception when others then null; end;
  return new;
end; $$;

drop trigger if exists deal_feedback_notify_trigger on deal_feedback;
create trigger deal_feedback_notify_trigger after insert on deal_feedback
  for each row execute function deal_feedback_notify_seller();

-- notify() هي SECURITY DEFINER وتكتب في صندوق مستخدم آخر — تُستدعى من
-- المشغّلات فقط. (الحجب مطبّق أصلاً في الهجرة 28؛ مكرّر هنا لأن الهجرات
-- تُطبَّق أحيانًا مفردة.)
revoke all on function notify(uuid, text, text, text, text) from anon, authenticated;
