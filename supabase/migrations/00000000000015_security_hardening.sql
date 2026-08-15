-- Fixes from a full code review of this project's history. Each block below
-- closes a real hole found by the review, not a hypothetical one — see
-- STATUS.md for the plain-language explanation of each.

-- ============================================================
-- 1. CRITICAL: SECURITY DEFINER functions with no SET search_path let a
-- caller shadow "profiles"/"listings" with a temp table (pg_temp is searched
-- before the default search_path) and trick the function into reading empty
-- attacker-controlled data instead of the real table — bypassing admin checks
-- and the daily listing cap entirely. Pinning search_path closes this.
-- ============================================================

alter function is_admin() set search_path = public, pg_temp;
alter function can_create_listing(uuid) set search_path = public, pg_temp;
alter function can_create_listing_today(uuid) set search_path = public, pg_temp;
alter function record_contact_click(uuid) set search_path = public, pg_temp;
alter function record_listing_view(uuid) set search_path = public, pg_temp;
alter function handle_new_user() set search_path = public, pg_temp;
alter function search_listings(text, int, int) set search_path = public, pg_temp;

-- ============================================================
-- 2. Scope migration 11's GRANT ALL down to what each role actually needs.
-- ALL includes TRUNCATE, which RLS cannot restrict at all — any anon/
-- authenticated code path able to run raw SQL could wipe a table outright.
-- RLS still governs individual rows for the privileges below.
-- ============================================================

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ============================================================
-- 3. CRITICAL: listings_update_own / sellers_update_own had no WITH CHECK,
-- so a seller's own UPDATE could silently change status/is_featured
-- (listings) or verification_status/free_listing_limit (sellers) — fields
-- only admin actions are supposed to touch.
--
-- WITH CHECK alone can't compare against the pre-update row (it only sees the
-- new row), so pinning is_featured/verification_status/free_listing_limit to
-- "unchanged" isn't expressible that way without blocking legitimate edits
-- that don't touch those fields. Column-level REVOKE is the right tool here:
-- it stops those specific columns from appearing in a seller's UPDATE at all,
-- while leaving every other column (title, description, price, business_name,
-- whatsapp_number...) freely editable.
-- ============================================================

-- category_id stays updatable — sellers legitimately re-categorize listings
-- when editing (app/dashboard/listings/[id]/edit/actions.ts).
revoke update (is_featured, seller_id) on listings from authenticated;
revoke update (verification_status, free_listing_limit, id) on sellers from authenticated;

drop policy if exists "listings_update_own" on listings;
create policy "listings_update_own" on listings for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid() and status in ('pending_review', 'archived'));

drop policy if exists "sellers_update_own" on sellers;
create policy "sellers_update_own" on sellers for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- 4. record_contact_click was missing the same "status = 'published'" guard
-- record_listing_view already has, letting anyone log a contact click (and
-- inflate a seller's stats) against a draft/pending/archived listing id.
-- ============================================================

create or replace function record_contact_click(p_listing_id uuid)
returns void as $$
begin
  insert into contact_clicks (listing_id)
    select p_listing_id
    where exists (
      select 1 from listings where id = p_listing_id and status = 'published'
    );

  update listings
    set contact_click_count = contact_click_count + 1
    where id = p_listing_id and status = 'published';
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ============================================================
-- 5. HIGH: sellers had no INSERT policy on subscriptions/payments, so
-- app/dashboard/subscription/actions.ts's insert was silently rejected by
-- RLS on every checkout attempt — the whole payment flow could never work.
-- ============================================================

drop policy if exists "subscriptions_insert_own" on subscriptions;
create policy "subscriptions_insert_own" on subscriptions for insert with check (
  seller_id = auth.uid()
);

drop policy if exists "payments_insert_own" on payments;
create policy "payments_insert_own" on payments for insert with check (
  seller_id = auth.uid()
);

-- ============================================================
-- 6. listings.slug had no unique constraint (unlike sellers.slug), so a
-- uniqueSlug() collision could silently produce two listings sharing a slug
-- and break /listing/[slug] (.single() errors on 2 rows -> 404 for both).
-- ============================================================

alter table listings add constraint listings_slug_key unique (slug);

-- ============================================================
-- 7. The 8-images-per-listing cap in image-actions.ts was a plain
-- count-then-insert from the app, which two concurrent uploads can both pass
-- before either insert lands (TOCTOU race). A trigger enforces it atomically:
-- the advisory lock serializes concurrent inserts for the same listing so the
-- count each one sees is accurate.
-- ============================================================

create or replace function enforce_listing_image_limit()
returns trigger as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.listing_id::text));

  if (select count(*) from listing_images where listing_id = new.listing_id) >= 8 then
    raise exception 'الحد الأقصى 8 صور لكل إعلان';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_enforce_listing_image_limit on listing_images;
create trigger trg_enforce_listing_image_limit
  before insert on listing_images
  for each row execute function enforce_listing_image_limit();
