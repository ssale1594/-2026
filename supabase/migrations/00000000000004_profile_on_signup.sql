-- Every auth.users row needs a matching profiles row: requireAdmin() reads
-- profiles.role, and sellers.id references profiles(id), so a seller cannot be
-- created before their profile exists.

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role)
  values (new.id, 'buyer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
