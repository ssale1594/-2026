-- Al-Zulfi neighborhoods — real list provided by the project owner (not an
-- assumption; see STATUS.md history for why this was left empty before).
-- region_id 1 is الزلفي, inserted by the initial schema.

insert into neighborhoods (region_id, name_ar, slug) values
  (1, 'الصديق', 'as-sadiq'),
  (1, 'الخالدية', 'al-khalidiyah'),
  (1, 'اليرموك', 'al-yarmouk'),
  (1, 'اليمامة', 'al-yamamah'),
  (1, 'عريعرة', 'uraiarah'),
  (1, 'سمنان', 'samnan'),
  (1, 'علقة', 'alqah'),
  (1, 'القدس', 'al-quds'),
  (1, 'السلام', 'as-salam'),
  (1, 'الروضة', 'ar-rawdah'),
  (1, 'العزيزية', 'al-aziziyah'),
  (1, 'الفاروق', 'al-farouq'),
  (1, 'الفيصلية', 'al-faisaliyah'),
  (1, 'حطين', 'hattin'),
  (1, 'الريان', 'ar-rayyan'),
  (1, 'المنتزه', 'al-muntazah'),
  (1, 'النهضة', 'an-nahdah'),
  (1, 'الفالح', 'al-falih'),
  (1, 'الدرعية', 'ad-diriyah'),
  (1, 'الربوة', 'ar-rabwah'),
  (1, 'قرطبة', 'qurtubah'),
  (1, 'السيح', 'as-sih'),
  (1, 'مرخ', 'markh'),
  (1, 'الملك فهد', 'king-fahd'),
  (1, 'الإسكان', 'al-iskan'),
  (1, 'الصناعية', 'industrial')
on conflict (region_id, slug) do nothing;
