-- listings.view_count exists in the initial schema but nothing increments it.
-- anon has no UPDATE policy on listings, so the bump goes through a definer function.

create or replace function record_listing_view(p_listing_id uuid)
returns void as $$
  update listings
    set view_count = view_count + 1
    where id = p_listing_id and status = 'published';
$$ language sql security definer;
