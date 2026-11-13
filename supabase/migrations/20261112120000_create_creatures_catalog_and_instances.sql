create table public.creature_types (
  id smallint primary key,
  slug text not null unique,
  name text not null unique,
  name_english text not null,
  name_japanese text not null,
  name_chinese text not null
);

create table public.creature_species (
  id smallint primary key check (id > 0),
  name text not null unique,
  name_english text not null,
  name_japanese text not null,
  name_chinese text not null,
  name_french text not null,
  base_health smallint not null check (base_health > 0),
  base_attack smallint not null check (base_attack > 0),
  base_special_attack smallint not null check (base_special_attack > 0),
  base_defense smallint not null check (base_defense > 0),
  base_special_defense smallint not null check (base_special_defense > 0),
  base_speed smallint not null check (base_speed > 0)
);

create table public.abilities (
  id smallint primary key check (id > 0),
  name text not null unique,
  name_english text not null,
  name_japanese text not null,
  name_chinese text not null,
  kind text not null default 'move' check (kind in ('move', 'species')),
  type_id smallint references public.creature_types (id),
  category text check (category in ('physical', 'special', 'status')),
  scaling_attribute text check (scaling_attribute in ('attack', 'special_attack')),
  power smallint check (power >= 0),
  accuracy smallint check (accuracy between 0 and 100),
  cooldown_seconds integer not null default 0 check (cooldown_seconds >= 0),
  required_level smallint not null default 1 check (required_level > 0),
  base_pp smallint check (base_pp > 0),
  tm smallint check (tm > 0),
  constraint abilities_kind_fields_check check (
    (kind = 'move' and type_id is not null and category is not null)
    or (
      kind = 'species'
      and type_id is null
      and category is null
      and scaling_attribute is null
      and power is null
      and accuracy is null
      and base_pp is null
      and tm is null
    )
  ),
  constraint abilities_scaling_attribute_consistency_check check (
    kind = 'species'
    or (category = 'status' and scaling_attribute is null)
    or (category in ('physical', 'special') and scaling_attribute is not null)
  )
);

create table public.creature_species_types (
  species_id smallint not null references public.creature_species (id) on delete cascade,
  type_id smallint not null references public.creature_types (id),
  slot smallint not null check (slot between 1 and 2),
  primary key (species_id, type_id),
  constraint creature_species_types_species_slot_key unique (species_id, slot)
);

create table public.creature_species_abilities (
  species_id smallint not null references public.creature_species (id) on delete cascade,
  ability_id smallint not null references public.abilities (id),
  slot smallint not null check (slot > 0),
  is_hidden boolean not null default false,
  primary key (species_id, ability_id),
  constraint creature_species_abilities_species_slot_hidden_key
    unique (species_id, slot, is_hidden)
);

create table public.creature_evolutions (
  id bigint generated always as identity primary key,
  from_species_id smallint not null references public.creature_species (id) on delete cascade,
  to_species_id smallint not null references public.creature_species (id) on delete cascade,
  required_level smallint check (required_level > 0),
  trigger text not null,
  condition text,
  constraint creature_evolutions_distinct_species_check check (from_species_id <> to_species_id),
  constraint creature_evolutions_from_to_trigger_key unique (
    from_species_id,
    to_species_id,
    trigger
  )
);

create or replace function public.creature_experience_for_level(creature_level integer)
returns bigint
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select public.character_experience_for_level(creature_level);
$$;

create or replace function public.creature_level_from_experience(creature_experience bigint)
returns smallint
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select public.character_level_from_experience(creature_experience);
$$;

create or replace function public.creature_rarity_from_total_ivs(total_ivs integer)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select case
    when total_ivs between 0 and 37 then 'common'
    when total_ivs between 38 and 74 then 'uncommon'
    when total_ivs between 75 and 111 then 'rare'
    when total_ivs between 112 and 148 then 'epic'
    when total_ivs between 149 and 186 then 'legendary'
  end;
$$;

create table public.creatures (
  id uuid primary key default gen_random_uuid(),
  species_id smallint not null references public.creature_species (id),
  character_id uuid,
  owner_user_id uuid references auth.users (id) on delete cascade,
  status text not null default 'wild' check (status in ('wild', 'stored', 'active')),
  team_position smallint check (team_position between 1 and 6),
  gender text not null check (gender in ('male', 'female')),
  experience bigint not null default 0 check (experience >= 0),
  level smallint generated always as (
    public.creature_level_from_experience(experience)
  ) stored,
  iv_health smallint not null check (iv_health between 0 and 31),
  iv_attack smallint not null check (iv_attack between 0 and 31),
  iv_special_attack smallint not null check (iv_special_attack between 0 and 31),
  iv_defense smallint not null check (iv_defense between 0 and 31),
  iv_special_defense smallint not null check (iv_special_defense between 0 and 31),
  iv_speed smallint not null check (iv_speed between 0 and 31),
  total_ivs smallint generated always as (
    iv_health + iv_attack + iv_special_attack + iv_defense + iv_special_defense + iv_speed
  ) stored,
  rarity text generated always as (
    public.creature_rarity_from_total_ivs(
      iv_health + iv_attack + iv_special_attack + iv_defense + iv_special_defense + iv_speed
    )
  ) stored,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  constraint creatures_character_owner
    foreign key (character_id, owner_user_id)
    references public.characters (id, user_id)
    match full
    on delete cascade,
  constraint creatures_status_ownership_check check (
    (status = 'wild' and character_id is null and owner_user_id is null)
    or (status in ('stored', 'active') and character_id is not null and owner_user_id is not null)
  ),
  constraint creatures_team_position_consistency_check check (
    (status = 'active' and team_position is not null)
    or (status <> 'active' and team_position is null)
  ),
  constraint creatures_capture_time_check check (
    (status = 'wild' and captured_at is null)
    or (status <> 'wild' and captured_at is not null)
  )
);

create index abilities_type_id_idx on public.abilities (type_id);
create index creature_species_types_type_id_idx on public.creature_species_types (type_id);
create index creature_species_abilities_ability_id_idx on public.creature_species_abilities (ability_id);
create index creature_evolutions_to_species_id_idx on public.creature_evolutions (to_species_id);
create index creatures_species_id_idx on public.creatures (species_id);
create index creatures_owner_user_id_idx on public.creatures (owner_user_id);
create index creatures_character_id_idx on public.creatures (character_id);
create unique index creatures_active_team_position_key
on public.creatures (character_id, team_position)
where status = 'active';

alter table public.creature_types enable row level security;
alter table public.creature_species enable row level security;
alter table public.abilities enable row level security;
alter table public.creature_species_types enable row level security;
alter table public.creature_species_abilities enable row level security;
alter table public.creature_evolutions enable row level security;
alter table public.creatures enable row level security;

revoke all on table public.creature_types from anon, authenticated;
revoke all on table public.creature_species from anon, authenticated;
revoke all on table public.abilities from anon, authenticated;
revoke all on table public.creature_species_types from anon, authenticated;
revoke all on table public.creature_species_abilities from anon, authenticated;
revoke all on table public.creature_evolutions from anon, authenticated;
revoke all on table public.creatures from anon, authenticated;

grant select on table public.creature_types to authenticated;
grant select on table public.creature_species to authenticated;
grant select on table public.abilities to authenticated;
grant select on table public.creature_species_types to authenticated;
grant select on table public.creature_species_abilities to authenticated;
grant select on table public.creature_evolutions to authenticated;
grant select on table public.creatures to authenticated;

create policy "Authenticated users can view creature types"
on public.creature_types for select to authenticated using (true);

create policy "Authenticated users can view creature species"
on public.creature_species for select to authenticated using (true);

create policy "Authenticated users can view abilities"
on public.abilities for select to authenticated using (true);

create policy "Authenticated users can view creature species types"
on public.creature_species_types for select to authenticated using (true);

create policy "Authenticated users can view creature species abilities"
on public.creature_species_abilities for select to authenticated using (true);

create policy "Authenticated users can view creature evolutions"
on public.creature_evolutions for select to authenticated using (true);

create policy "Users can view owned and wild creatures"
on public.creatures
for select
to authenticated
using (owner_user_id = (select auth.uid()) or status = 'wild');

revoke all on function public.creature_experience_for_level(integer) from public, anon, authenticated;
revoke all on function public.creature_level_from_experience(bigint) from public, anon, authenticated;
revoke all on function public.creature_rarity_from_total_ivs(integer) from public, anon, authenticated;
