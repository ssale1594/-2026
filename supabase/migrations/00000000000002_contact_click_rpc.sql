-- Records a WhatsApp contact click and keeps listings.contact_click_count in sync.
-- security definer: anon clients can log clicks (contact_clicks_insert policy already
-- allows this) but have no UPDATE policy on listings, so the counter bump must happen
-- through a function that runs with the owner's privileges.

create or replace function record_contact_click(p_listing_id uuid)
returns void as $$
begin
  insert into contact_clicks (listing_id) values (p_listing_id);

  update listings
    set contact_click_count = contact_click_count + 1
    where id = p_listing_id;
end;
$$ language plpgsql security definer;
