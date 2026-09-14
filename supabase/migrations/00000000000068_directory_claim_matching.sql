-- عند تسجيل بائع جديد، نطابق اسم نشاطه تلقائيًا مع سجلات الدليل العام غير
-- المتبنّاة (استيراد خرائط قوقل وغيره) — بدل ما ينتظر يتصفح /map بنفسه ويلقى
-- محله. تُستدعى من app/dashboard/setup بعد إنشاء حساب البائع مباشرة، وأيضًا
-- من صفحة التأكيد (/dashboard/setup/match) لإعادة نفس المطابقة بدون تمرير
-- حالة عبر الرابط.
create or replace function match_unclaimed_directory(p_business_name text)
returns table (
  id bigint,
  business_name text,
  category_name text,
  neighborhood_name text,
  address_note text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select d.id, d.business_name, c.name_ar, n.name_ar, d.address_note
    from directory_entries d
    left join categories c on c.id = d.category_id
    left join neighborhoods n on n.id = d.neighborhood_id
   where d.status = 'published'
     and d.claimed_by_seller_id is null
     and length(trim(coalesce(p_business_name, ''))) >= 2
     and (
       lower(trim(d.business_name)) = lower(trim(p_business_name))
       or d.business_name ilike '%' || p_business_name || '%'
       or p_business_name ilike '%' || d.business_name || '%'
     )
   order by (lower(trim(d.business_name)) = lower(trim(p_business_name))) desc
   limit 5;
$$;

grant execute on function match_unclaimed_directory(text) to authenticated;
