create table public.hunting_location_wave_ranges (
  hunting_location_id smallint not null references public.hunting_locations (id) on delete cascade,
  minimum_size smallint not null check (minimum_size > 0),
  maximum_size smallint not null check (maximum_size >= minimum_size),
  primary key (hunting_location_id, minimum_size, maximum_size)
);

alter table public.hunting_location_wave_ranges enable row level security;

grant select on public.hunting_location_wave_ranges to authenticated;

create policy static_location_wave_ranges_read on public.hunting_location_wave_ranges
for select to authenticated using (true);
