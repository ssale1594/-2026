-- Placeholder pricing (99 SAR/month) — explicitly temporary, owner will revise.
-- Changing the price later is a plain UPDATE, no code changes needed.
-- No unique constraint on plans.name, so re-running this script safely needs an
-- explicit existence check instead of ON CONFLICT.
insert into plans (name, monthly_price, yearly_price, free_listing_limit, is_active)
select 'الخطة الأساسية', 99, null, 8, true
where not exists (select 1 from plans where name = 'الخطة الأساسية');
