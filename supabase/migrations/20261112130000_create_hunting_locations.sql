create table public.hunting_locations (
  id smallint primary key check (id > 0),
  slug text not null unique,
  name text not null unique,
  description text not null,
  position_x integer not null check (position_x >= 0),
  position_y integer not null check (position_y >= 0)
);

create table public.hunting_location_species (
  hunting_location_id smallint not null
    references public.hunting_locations (id) on delete cascade,
  species_id smallint not null references public.creature_species (id),
  slot smallint not null check (slot between 1 and 2),
  minimum_level smallint not null check (minimum_level > 0),
  maximum_level smallint not null check (maximum_level > 0),
  encounter_weight smallint not null default 1 check (encounter_weight > 0),
  primary key (hunting_location_id, species_id),
  constraint hunting_location_species_location_slot_key
    unique (hunting_location_id, slot),
  constraint hunting_location_species_level_range_check
    check (maximum_level >= minimum_level)
);

create index hunting_location_species_species_id_idx
on public.hunting_location_species (species_id);

alter table public.hunting_locations enable row level security;
alter table public.hunting_location_species enable row level security;

revoke all on table public.hunting_locations from anon, authenticated;
revoke all on table public.hunting_location_species from anon, authenticated;

grant select on table public.hunting_locations to authenticated;
grant select on table public.hunting_location_species to authenticated;

create policy "Authenticated users can view hunting locations"
on public.hunting_locations for select to authenticated using (true);

create policy "Authenticated users can view hunting location species"
on public.hunting_location_species for select to authenticated using (true);
