-- ============================================================
-- تطوير نظام التوصيات (Vouches) + Endorsements
-- إضافة أعمدة جديدة للتعليق والعلاقة + عرض آخر الشهادات
-- ============================================================

alter table vouches add column if not exists comment text check (char_length(coalesce(comment, '')) <= 400);
alter table vouches add column if not exists relation text
  check (relation is null or relation in (
    'customer', 'neighbour', 'family', 'friend', 'repeated_customer', 'service_provider', 'other'
  ));
alter table vouches add column if not exists updated_at timestamptz not null default now();

create or replace function vouches_set_updated() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists vouches_updated_trigger on vouches;
create trigger vouches_updated_trigger before update on vouches
  for each row execute function vouches_set_updated();

-- سحب آخر N شهادة لصفحة البائع (مع اسم الشخص + صورة إن وجدت)
create or replace function seller_vouch_feed(p_seller_id uuid, p_limit int default 20)
returns table (
  id bigint,
  created_at timestamptz,
  comment text,
  relation text,
  voucher_id uuid,
  voucher_full_name text,
  voucher_avatar text,
  voucher_trust text,
  trust_label text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  select
    v.id,
    v.created_at,
    v.comment,
    v.relation,
    v.voucher_id,
    coalesce(p.full_name, 'جارٍ في الزلفي')::text,
    coalesce(m.avatar_url, '')::text,
    coalesce(p.trust_level::text, '0'),
    case
      when coalesce(p.trust_level, 0)::int >= 3 then 'موصى به في الحي'
      when coalesce(p.trust_level, 0)::int >= 2 then 'موثّق'
      when coalesce(p.trust_level, 0)::int >= 1 then 'حساب جديد موثّق'
      else 'عضو مجتمع'
    end::text
  from vouches v
  left join profiles p on p.id = v.voucher_id
  left join profiles_meta m on m.profile_id = v.voucher_id
  where v.seller_id = p_seller_id
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end; $$;
grant execute on function seller_vouch_feed(uuid, int) to anon, authenticated;

-- دالة: صار الموصّي له صلاحية تعديل تعليقه فقط خلال 30 يومًا
drop policy if exists "voucher updates own within 30d" on vouches;
create policy "voucher updates own within 30d"
  on vouches for update using (
    voucher_id = auth.uid()
    and created_at > now() - interval '30 days'
  ) with check (
    voucher_id = auth.uid()
    and created_at > now() - interval '30 days'
    and seller_id = seller_id
    and voucher_id = voucher_id
  );
grant update on vouches to authenticated;

-- ملخص سريع للبائع (للكروت في البحث)
create or replace function seller_endorsement_summary(p_seller_id uuid)
returns table (
  vouch_count bigint,
  with_comment_count bigint,
  latest_vouch_at timestamptz,
  top_relation text,
  last_comment text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
  with rel_counts as (
    select coalesce(relation, 'customer') as r, count(*) as c
    from vouches
    where seller_id = p_seller_id
    group by 1
    order by 2 desc
    limit 1
  )
  select
    (select count(*) from vouches where seller_id = p_seller_id)::bigint,
    (select count(*) from vouches where seller_id = p_seller_id and comment is not null and char_length(comment) > 0)::bigint,
    (select max(created_at) from vouches where seller_id = p_seller_id),
    (select r from rel_counts limit 1),
    (select comment from vouches where seller_id = p_seller_id and comment is not null order by created_at desc limit 1);
end; $$;
grant execute on function seller_endorsement_summary(uuid) to anon, authenticated;
