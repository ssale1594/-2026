-- ============================================================
-- نشرة "وش الجديد بالزلفي" الدورية — ROADMAP المرحلة 2 §5
-- ============================================================
--
-- /whats-new (موجودة أصلًا) هي فقط صفحة يزورها المستخدم بنفسه. الجزء
-- "الدوري" اللي طلبه ROADMAP (original§13.2, Kimi§21.16, DeepSeek§19.19,
-- ChatGPT§20.23) غير موجود: ما فيه طريقة توصل آخر الإعلانات للمستخدم من
-- غير ما يفتح الموقع بنفسه.
--
-- المشتري بالتصميم بلا حساب (TECH.md §5 — "لا حاجة لتسجيل الدخول عشان
-- تتصفح")، فالاشتراك بالنشرة لازم يكون بالإيميل فقط بلا حساب — جدول منفصل
-- عن profiles، برمز إلغاء اشتراك عام بلا تسجيل دخول.

-- gen_random_bytes() below needs pgcrypto; already enabled by migration 17,
-- but declared again here so this file has no hidden dependency on it.
create extension if not exists pgcrypto;

create table if not exists newsletter_subscribers (
  id bigserial primary key,
  email text not null unique,
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists newsletter_active_idx
  on newsletter_subscribers (email) where unsubscribed_at is null;

alter table newsletter_subscribers enable row level security;

-- لا SELECT عام إطلاقًا (حتى ما يقدر أحد يسحب قائمة إيميلات الناس) — القراءة
-- فقط عبر service_role بمهمة الإرسال. الاشتراك والإلغاء عبر الدالتين أدناه.
revoke all on newsletter_subscribers from anon, authenticated;

create or replace function newsletter_subscribe(p_email text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'بريد إلكتروني غير صالح';
  end if;

  insert into newsletter_subscribers (email)
  values (lower(trim(p_email)))
  on conflict (email) do update
    set unsubscribed_at = null
    where newsletter_subscribers.unsubscribed_at is not null;
end $$;

grant execute on function newsletter_subscribe(text) to anon, authenticated;

create or replace function newsletter_unsubscribe(p_token text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_found boolean;
begin
  update newsletter_subscribers
     set unsubscribed_at = now()
   where unsubscribe_token = p_token and unsubscribed_at is null
  returning true into v_found;

  return coalesce(v_found, false);
end $$;

grant execute on function newsletter_unsubscribe(text) to anon, authenticated;

-- تُستدعى فقط من service_role (مهمة الإرسال) — تُرجع المشتركين النشطين
-- بالإضافة إلى رمز إلغاء الاشتراك الخاص بكل واحد.
create or replace function newsletter_active_recipients()
returns table (email text, unsubscribe_token text)
language sql stable security definer set search_path = public, pg_temp as $$
  select email, unsubscribe_token
    from newsletter_subscribers
   where unsubscribed_at is null;
$$;

revoke all on function newsletter_active_recipients() from anon, authenticated;
grant execute on function newsletter_active_recipients() to service_role;

-- آخر إعلانات منشورة خلال 7 أيام، بترتيب وبحد أقصى — استعلام واحد بدل N+1.
create or replace function newsletter_weekly_listings(p_limit int default 12)
returns table (
  title text, slug text, price numeric, price_negotiable boolean,
  category_name text, seller_name text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select l.title, l.slug, l.price, l.price_negotiable,
         c.name_ar, s.business_name
    from listings l
    left join categories c on c.id = l.category_id
    left join sellers s on s.id = l.seller_id
   where l.status = 'published'
     and l.published_at > now() - interval '7 days'
   order by l.published_at desc
   limit p_limit;
$$;

grant execute on function newsletter_weekly_listings(int) to service_role;
