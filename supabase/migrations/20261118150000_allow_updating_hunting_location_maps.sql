-- Allow updating map_data and tileset_url on hunting_locations
alter table public.hunting_locations
  alter column tileset_url set default '/assets/tilesets/exterior.png';

create policy hunting_locations_admin_update on public.hunting_locations
  for update
  to authenticated
  using (true)
  with check (true);
