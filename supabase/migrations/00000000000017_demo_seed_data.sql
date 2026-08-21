-- Demo/test data: one dummy shop seller + one home-producer seller, each with
-- one published listing, so the live site has real content to browse before
-- the first actual seller signs up. NOT real accounts — bypasses the normal
-- signup/review flow by inserting auth.users directly (fine for seed data,
-- never do this for a real seller).
--
-- ⚠️ Remove these two sellers (cascades to their listings via FK) once real
-- sellers start signing up, so demo content doesn't linger on the live site.

create extension if not exists pgcrypto;

do $$
declare
  v_dummy_shop_id uuid;
  v_home_producer_id uuid;
  v_shops_category_id int;
  v_home_producers_category_id int;
  v_neighborhood_1 int;
  v_neighborhood_2 int;
begin
  -- Skip entirely if this has already run (idempotent across SQL Editor re-runs).
  if exists (select 1 from sellers where slug = 'demo-shop') then
    return;
  end if;

  select id into v_shops_category_id from categories where slug = 'shops';
  select id into v_home_producers_category_id from categories where slug = 'home-producers';
  select id into v_neighborhood_1 from neighborhoods where slug = 'as-sadiq';
  select id into v_neighborhood_2 from neighborhoods where slug = 'al-yarmouk';

  -- Dummy shop seller
  v_dummy_shop_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_dummy_shop_id, 'authenticated', 'authenticated',
    'demo-shop@example.com', crypt('demo-not-a-real-account', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into sellers (
    id, region_id, business_name, business_type, slug, description,
    whatsapp_number, verification_status
  ) values (
    v_dummy_shop_id, 1, 'محل تجريبي — للعرض فقط', 'shop', 'demo-shop',
    'حساب تجريبي لعرض شكل الموقع قبل انضمام أول بائع حقيقي.',
    '966500000001', 'approved'
  );

  insert into listings (
    seller_id, category_id, neighborhood_id, listing_type, title, slug,
    description, price, price_negotiable, status, published_at
  ) values (
    v_dummy_shop_id, v_shops_category_id, v_neighborhood_1, 'product',
    'منتج تجريبي', 'demo-product-1',
    'إعلان تجريبي لعرض شكل صفحة المنتج قبل انضمام أول بائع حقيقي.',
    50, false, 'published', now()
  );

  -- Home-producer seller
  v_home_producer_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_home_producer_id, 'authenticated', 'authenticated',
    'demo-home-producer@example.com', crypt('demo-not-a-real-account', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into sellers (
    id, region_id, business_name, business_type, slug, description,
    whatsapp_number, verification_status
  ) values (
    v_home_producer_id, 1, 'أسرة منتجة تجريبية — للعرض فقط', 'home_producer', 'demo-home-producer',
    'حساب تجريبي لعرض شكل الموقع قبل انضمام أول أسرة منتجة حقيقية.',
    '966500000002', 'approved'
  );

  insert into listings (
    seller_id, category_id, neighborhood_id, listing_type, title, slug,
    description, price, price_negotiable, status, published_at
  ) values (
    v_home_producer_id, v_home_producers_category_id, v_neighborhood_2, 'product',
    'كيكة تجريبية', 'demo-product-2',
    'إعلان تجريبي لعرض شكل صفحة المنتج قبل انضمام أول أسرة منتجة حقيقية.',
    80, true, 'published', now()
  );
end $$;
