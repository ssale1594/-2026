-- Al-Zulfi neighborhoods (TECH.md §2 — never store the neighborhood as free text,
-- that is how "السلام" / "حي السلام" / "السلّام" end up as three different places).
-- region_id 1 is الزلفي, inserted by the initial schema.

insert into neighborhoods (region_id, name_ar, slug) values
  (1, 'الروضة', 'al-rawdah'),
  (1, 'النهضة', 'al-nahdah'),
  (1, 'السلام', 'al-salam'),
  (1, 'الفيصلية', 'al-faisaliyah'),
  (1, 'الملك فهد', 'king-fahd'),
  (1, 'الخالدية', 'al-khalidiyah'),
  (1, 'الربوة', 'al-rabwah'),
  (1, 'المروج', 'al-muruj'),
  (1, 'الصناعية', 'industrial'),
  (1, 'وسط المدينة', 'downtown')
on conflict (region_id, slug) do nothing;
