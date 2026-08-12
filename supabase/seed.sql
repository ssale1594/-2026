-- Seed data: the 5 core categories agreed in PLAN.md §2 / TECH.md
insert into categories (name_ar, slug, listing_type, sort_order) values
  ('محلات تجارية', 'shops', 'product', 1),
  ('أسر منتجة', 'home-producers', 'product', 2),
  ('خدمات', 'services', 'service', 3),
  ('عقار', 'real-estate', 'real_estate', 4),
  ('سوق مستعمل', 'used-items', 'used_item', 5);
