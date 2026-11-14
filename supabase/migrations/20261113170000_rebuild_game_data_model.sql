create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_character_name(value text)
returns text
language sql immutable parallel safe strict set search_path = ''
as $$ select pg_catalog.lower(extensions.unaccent(value)); $$;

create or replace function public.creature_level_from_experience(value bigint)
returns smallint
language plpgsql immutable parallel safe strict set search_path = '' as $$
declare level smallint := 1;
begin
  while level < 100 and (50::bigint * (level + 1) * (level + 1) * (level + 1) - 150::bigint * (level + 1) * (level + 1) + 400::bigint * (level + 1)) / 3 <= value loop
    level := level + 1;
  end loop;
  return level;
end; $$;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  name text not null,
  gender text not null default 'male' check (gender in ('male', 'female')),
  experience bigint not null default 0 check (experience >= 0),
  position_x integer not null default 0 check (position_x >= 0),
  position_y integer not null default 0 check (position_y >= 0),
  gold bigint not null default 100 check (gold >= 0),
  name_normalized text generated always as (public.normalize_character_name(name)) stored,
  created_at timestamptz not null default now(),
  constraint characters_name_length check (char_length(name) between 3 and 15),
  constraint characters_name_format check (name = btrim(name) and name !~ '  ' and name ~ '^[[:alpha:] ''_-]+$'),
  unique (user_id, slot), unique (id, user_id)
);
create unique index characters_name_normalized_key on public.characters (name_normalized);

create table public.types (
  id smallint primary key,
  slug text not null unique,
  name text not null unique,
  is_legacy boolean not null default false
);
create table public.type_effectiveness (
  attacker_type_id smallint not null references public.types (id),
  defender_type_id smallint not null references public.types (id),
  multiplier numeric(3,2) not null check (multiplier in (0, 0.5, 1, 2)),
  primary key (attacker_type_id, defender_type_id)
);

create table public.items (
  id smallint primary key,
  slug text not null unique,
  name text not null unique,
  category text not null check (category in ('medicine', 'poke_ball', 'evolution_stone')),
  buy_price integer not null check (buy_price >= 0),
  sell_price integer not null check (sell_price >= 0),
  effect_description text not null,
  healing_amount smallint check (healing_amount > 0),
  restores_full_health boolean not null default false,
  restores_pp boolean not null default false,
  revives boolean not null default false,
  capture_rate_multiplier numeric(6,2) check (capture_rate_multiplier > 0),
  constraint items_effect_data_check check (
    category <> 'poke_ball' or capture_rate_multiplier is not null
  )
);

create table public.species (
  id smallint primary key check (id between 1 and 151),
  slug text not null unique,
  name text not null unique,
  height_decimeters smallint not null check (height_decimeters > 0),
  weight_hectograms smallint not null check (weight_hectograms > 0),
  description text not null,
  gender_rate smallint not null check (gender_rate between -1 and 8),
  base_hp smallint not null check (base_hp > 0),
  base_attack smallint not null check (base_attack > 0),
  base_defense smallint not null check (base_defense > 0),
  base_special_attack smallint not null check (base_special_attack > 0),
  base_special_defense smallint not null check (base_special_defense > 0),
  base_speed smallint not null check (base_speed > 0)
);
create table public.species_types (
  species_id smallint not null references public.species (id) on delete cascade,
  type_id smallint not null references public.types (id),
  slot smallint not null check (slot > 0),
  primary key (species_id, type_id), unique (species_id, slot)
);

create table public.moves (
  id smallint primary key check (id between 1 and 165),
  slug text not null unique,
  name text not null unique,
  type_id smallint not null references public.types (id),
  category text not null check (category in ('physical', 'special', 'status')),
  power smallint check (power > 0),
  accuracy smallint check (accuracy between 1 and 100),
  base_pp smallint not null check (base_pp > 0),
  priority smallint not null default 0,
  effect_description text not null,
  cooldown_ms integer not null check (cooldown_ms >= 1000),
  delivery text not null check (delivery in ('melee', 'ranged')),
  target text not null check (target in ('self', 'unit', 'tile')),
  area_shape text not null check (area_shape in ('single', 'square', 'line', 'cone', 'ring')),
  range_tiles smallint not null check (range_tiles >= 0),
  area_radius smallint not null default 0 check (area_radius >= 0),
  area_length smallint not null default 0 check (area_length >= 0),
  area_width smallint not null default 0 check (area_width >= 0),
  constraint moves_target_shape_check check (
    (area_shape = 'single' and area_radius = 0 and area_length = 0 and area_width = 0)
    or area_shape <> 'single'
  )
);
create table public.species_move_learnsets (
  species_id smallint not null references public.species (id) on delete cascade,
  move_id smallint not null references public.moves (id),
  learn_method text not null check (learn_method in ('level', 'machine')),
  required_level smallint check (required_level > 0),
  machine_code text,
  primary key (species_id, move_id, learn_method),
  constraint species_move_learnsets_details_check check (
    (learn_method = 'level' and required_level is not null and machine_code is null)
    or (learn_method = 'machine' and required_level is null and machine_code is not null)
  )
);
create table public.evolutions (
  id bigint generated always as identity primary key,
  from_species_id smallint not null references public.species (id) on delete cascade,
  to_species_id smallint not null references public.species (id) on delete cascade,
  trigger text not null check (trigger in ('level', 'item', 'trade')),
  required_level smallint check (required_level > 0),
  required_item_id smallint references public.items (id),
  constraint evolutions_distinct_species_check check (from_species_id <> to_species_id),
  constraint evolutions_trigger_data_check check (
    (trigger = 'level' and required_level is not null and required_item_id is null)
    or (trigger = 'item' and required_level is null and required_item_id is not null)
    or (trigger = 'trade' and required_level is null and required_item_id is null)
  ),
  unique (from_species_id, to_species_id, trigger)
);

create table public.creatures (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  species_id smallint not null references public.species (id),
  party_slot smallint check (party_slot between 1 and 6),
  gender text not null check (gender in ('male', 'female')),
  experience bigint not null default 0 check (experience >= 0),
  level smallint generated always as (public.creature_level_from_experience(experience)) stored,
  iv_hp smallint not null check (iv_hp between 0 and 31),
  iv_attack smallint not null check (iv_attack between 0 and 31),
  iv_defense smallint not null check (iv_defense between 0 and 31),
  iv_special_attack smallint not null check (iv_special_attack between 0 and 31),
  iv_special_defense smallint not null check (iv_special_defense between 0 and 31),
  iv_speed smallint not null check (iv_speed between 0 and 31),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index creatures_character_party_slot_key on public.creatures (character_id, party_slot) where party_slot is not null;
create table public.creature_learned_moves (
  creature_id uuid not null references public.creatures (id) on delete cascade,
  move_id smallint not null references public.moves (id),
  learned_at_level smallint not null check (learned_at_level > 0),
  primary key (creature_id, move_id)
);
create table public.creature_equipped_moves (
  creature_id uuid not null,
  move_id smallint not null,
  slot smallint not null check (slot between 1 and 4),
  primary key (creature_id, slot), unique (creature_id, move_id),
  foreign key (creature_id, move_id)
    references public.creature_learned_moves (creature_id, move_id) on delete cascade
);
create table public.character_items (
  character_id uuid not null references public.characters (id) on delete cascade,
  item_id smallint not null references public.items (id),
  quantity integer not null check (quantity >= 0),
  primary key (character_id, item_id)
);
create table public.character_battle_item_configuration (
  character_id uuid primary key references public.characters (id) on delete cascade,
  item_id smallint not null references public.items (id),
  threshold_percentage smallint not null check (threshold_percentage between 1 and 100)
);

create function public.validate_character_inventory_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.items
    where items.id = new.item_id and items.category in ('medicine', 'poke_ball')
  ) then
    raise exception using message = 'immediate_purchase_items_cannot_be_inventory_items';
  end if;
  return new;
end; $$;
create trigger validate_character_inventory_item
before insert or update of item_id on public.character_items
for each row execute function public.validate_character_inventory_item();

create table public.hunting_locations (
  id smallint primary key check (id > 0), slug text not null unique, name text not null unique,
  description text not null, position_x integer not null check (position_x >= 0),
  position_y integer not null check (position_y >= 0), wave_delay_seconds smallint not null default 3 check (wave_delay_seconds >= 0)
);
create table public.hunting_location_species (
  hunting_location_id smallint not null references public.hunting_locations (id) on delete cascade,
  species_id smallint not null references public.species (id), slot smallint not null check (slot > 0),
  minimum_level smallint not null check (minimum_level > 0), maximum_level smallint not null check (maximum_level >= minimum_level),
  encounter_weight smallint not null default 1 check (encounter_weight > 0),
  primary key (hunting_location_id, species_id), unique (hunting_location_id, slot)
);
create table public.character_hunts (
  character_id uuid primary key references public.characters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade, hunt_id uuid not null default gen_random_uuid() unique,
  hunting_location_id smallint not null references public.hunting_locations (id), active_creature_id uuid not null references public.creatures (id),
  active_creature_health integer not null check (active_creature_health >= 0), player_position jsonb not null,
  enemies jsonb not null, next_event_at timestamptz not null, wave integer not null default 1 check (wave > 0),
  wave_size smallint not null default 1 check (wave_size between 1 and 5), revision bigint not null default 1 check (revision > 0),
  wave_delay_seconds smallint not null default 3 check (wave_delay_seconds >= 0), combat_events jsonb not null default '[]'::jsonb,
  ability_cooldowns jsonb not null default '{}'::jsonb, runtime_snapshot jsonb not null, started_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id), foreign key (character_id, user_id) references public.characters (id, user_id) on delete cascade
);
create table public.character_hunt_checkpoint_receipts (
  checkpoint_id uuid primary key, hunt_id uuid not null, expected_revision bigint not null check (expected_revision >= 0),
  payload_fingerprint jsonb not null, resulting_revision bigint not null check (resulting_revision > expected_revision),
  finished boolean not null, created_at timestamptz not null default now()
);
create index character_hunt_checkpoint_receipts_hunt_id_idx on public.character_hunt_checkpoint_receipts (hunt_id);
create index species_types_type_id_idx on public.species_types (type_id);
create index species_move_learnsets_move_id_idx on public.species_move_learnsets (move_id);
create index evolutions_to_species_id_idx on public.evolutions (to_species_id);
create index creatures_character_id_idx on public.creatures (character_id);
create index creatures_species_id_idx on public.creatures (species_id);
create index character_items_item_id_idx on public.character_items (item_id);

alter table public.characters enable row level security;
alter table public.types enable row level security;
alter table public.type_effectiveness enable row level security;
alter table public.items enable row level security;
alter table public.species enable row level security;
alter table public.species_types enable row level security;
alter table public.moves enable row level security;
alter table public.species_move_learnsets enable row level security;
alter table public.evolutions enable row level security;
alter table public.creatures enable row level security;
alter table public.creature_learned_moves enable row level security;
alter table public.creature_equipped_moves enable row level security;
alter table public.character_items enable row level security;
alter table public.character_battle_item_configuration enable row level security;
alter table public.hunting_locations enable row level security;
alter table public.hunting_location_species enable row level security;
alter table public.character_hunts enable row level security;
alter table public.character_hunt_checkpoint_receipts enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.types, public.type_effectiveness, public.items, public.species, public.species_types,
  public.moves, public.species_move_learnsets, public.evolutions, public.hunting_locations, public.hunting_location_species to authenticated;
grant select on public.characters, public.creatures, public.creature_learned_moves, public.creature_equipped_moves,
  public.character_items, public.character_battle_item_configuration, public.character_hunts to authenticated;

create policy characters_own on public.characters for select to authenticated using ((select auth.uid()) = user_id);
create policy static_read on public.types for select to authenticated using (true);
create policy static_effectiveness_read on public.type_effectiveness for select to authenticated using (true);
create policy static_items_read on public.items for select to authenticated using (true);
create policy static_species_read on public.species for select to authenticated using (true);
create policy static_species_types_read on public.species_types for select to authenticated using (true);
create policy static_moves_read on public.moves for select to authenticated using (true);
create policy static_learnsets_read on public.species_move_learnsets for select to authenticated using (true);
create policy static_evolutions_read on public.evolutions for select to authenticated using (true);
create policy static_locations_read on public.hunting_locations for select to authenticated using (true);
create policy static_location_species_read on public.hunting_location_species for select to authenticated using (true);
create policy creatures_own on public.creatures for select to authenticated using (exists (select 1 from public.characters where characters.id = creatures.character_id and characters.user_id = (select auth.uid())));
create policy learned_moves_own on public.creature_learned_moves for select to authenticated using (exists (select 1 from public.creatures join public.characters on characters.id = creatures.character_id where creatures.id = creature_learned_moves.creature_id and characters.user_id = (select auth.uid())));
create policy equipped_moves_own on public.creature_equipped_moves for select to authenticated using (exists (select 1 from public.creatures join public.characters on characters.id = creatures.character_id where creatures.id = creature_equipped_moves.creature_id and characters.user_id = (select auth.uid())));
create policy character_items_own on public.character_items for select to authenticated using (exists (select 1 from public.characters where characters.id = character_items.character_id and characters.user_id = (select auth.uid())));
create policy battle_configuration_own on public.character_battle_item_configuration for select to authenticated using (exists (select 1 from public.characters where characters.id = character_battle_item_configuration.character_id and characters.user_id = (select auth.uid())));
create policy hunts_own on public.character_hunts for select to authenticated using ((select auth.uid()) = user_id);

create function public.configure_creature_equipped_move(target_creature_id uuid, target_slot smallint, target_move_id smallint default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_slot not between 1 and 4 then raise exception using message = 'invalid_move_slot'; end if;
  insert into public.creature_learned_moves (creature_id, move_id, learned_at_level)
  select creatures.id, learnset.move_id, learnset.required_level
  from public.creatures
  join public.species_move_learnsets as learnset on learnset.species_id = creatures.species_id
  where creatures.id = target_creature_id
    and learnset.learn_method = 'level'
    and learnset.required_level <= creatures.level
    and (target_move_id is null or learnset.move_id = target_move_id)
  on conflict (creature_id, move_id) do nothing;
  if target_move_id is not null and not exists (select 1 from public.creature_learned_moves where creature_id = target_creature_id and move_id = target_move_id) then raise exception using message = 'move_not_learned'; end if;
  delete from public.creature_equipped_moves where creature_id = target_creature_id and (slot = target_slot or move_id = target_move_id);
  if target_move_id is not null then insert into public.creature_equipped_moves (creature_id, move_id, slot) values (target_creature_id, target_move_id, target_slot); end if;
end; $$;
revoke all on function public.configure_creature_equipped_move(uuid, smallint, smallint) from public, anon, authenticated;
grant execute on function public.configure_creature_equipped_move(uuid, smallint, smallint) to service_role;

create function public.purchase_character_battle_item(target_character_id uuid, target_item_id smallint)
returns table (gold bigint, healing_amount integer, restores_full_health boolean)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.characters as characters
  set gold = characters.gold - items.buy_price
  from public.items
  where characters.id = target_character_id
    and items.id = target_item_id
    and items.category in ('medicine', 'poke_ball')
    and characters.gold >= items.buy_price
  returning characters.gold, items.healing_amount::integer, items.restores_full_health;
end; $$;
revoke all on function public.purchase_character_battle_item(uuid, smallint) from public, anon, authenticated;
grant execute on function public.purchase_character_battle_item(uuid, smallint) to service_role;

create function public.give_starter_creature(target_character_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_creature_id uuid;
begin
  insert into public.creatures (character_id, species_id, party_slot, gender, iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed)
  values (target_character_id, (array[1, 4, 7])[1 + floor(random() * 3)::integer], 1, case when random() < .5 then 'male' else 'female' end, 15, 15, 15, 15, 15, 15)
  returning id into created_creature_id;
  insert into public.creature_learned_moves (creature_id, move_id, learned_at_level)
  select created_creature_id, learnset.move_id, learnset.required_level
  from public.creatures join public.species_move_learnsets as learnset on learnset.species_id = creatures.species_id
  where creatures.id = created_creature_id and learnset.learn_method = 'level' and learnset.required_level <= creatures.level;
  insert into public.creature_equipped_moves (creature_id, move_id, slot)
  select created_creature_id, learned.move_id, row_number() over (order by learned.learned_at_level, learned.move_id)::smallint
  from public.creature_learned_moves as learned where learned.creature_id = created_creature_id
  order by learned.learned_at_level, learned.move_id limit 4;
  return created_creature_id;
end; $$;

create function public.create_character(character_name text, character_gender text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); available_slot smallint; created_character_id uuid;
begin
  if current_user_id is null then raise exception using message = 'authentication_required'; end if;
  if character_gender not in ('male', 'female') or character_gender is null then raise exception using message = 'invalid_character_gender'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));
  select slot into available_slot from pg_catalog.generate_series(1, 5) as candidate(slot)
  where not exists (select 1 from public.characters where user_id = current_user_id and slot = candidate.slot)
  order by slot limit 1;
  if available_slot is null then raise exception using message = 'character_limit_reached'; end if;
  insert into public.characters (user_id, slot, name, gender) values (current_user_id, available_slot, character_name, character_gender) returning id into created_character_id;
  perform public.give_starter_creature(created_character_id);
  return created_character_id;
exception when unique_violation then
  raise exception using message = 'character_name_unavailable';
end; $$;
revoke all on function public.create_character(text, text) from public, anon;
grant execute on function public.create_character(text, text) to authenticated;

create function public.checkpoint_character_hunt(
  expected_hunt_id uuid, expected_revision bigint, checkpoint_id uuid, next_active_creature_id uuid,
  next_active_creature_health integer, next_player_position jsonb, next_enemies jsonb, next_wave integer,
  next_event_time timestamptz, next_combat_events jsonb, next_ability_cooldowns jsonb, next_runtime_snapshot jsonb,
  experience_deltas jsonb default '[]'::jsonb, finish_hunt boolean default false
)
returns table (applied boolean, next_revision bigint, finished boolean)
language plpgsql security definer set search_path = '' as $$
declare receipt public.character_hunt_checkpoint_receipts%rowtype; updated_revision bigint; experience_delta jsonb;
begin
  select * into receipt from public.character_hunt_checkpoint_receipts where checkpoint_id = checkpoint_character_hunt.checkpoint_id;
  if found then return query select true, receipt.resulting_revision, receipt.finished; return; end if;
  if finish_hunt then
    delete from public.character_hunts where hunt_id = expected_hunt_id and revision = expected_revision returning revision into updated_revision;
    if not found then return query select false, null::bigint, false; return; end if;
    insert into public.character_hunt_checkpoint_receipts values (checkpoint_id, expected_hunt_id, expected_revision, '{}'::jsonb, expected_revision + 1, true);
    return query select true, expected_revision + 1, true; return;
  end if;
  if jsonb_typeof(experience_deltas) <> 'array' then raise exception using message = 'invalid_experience_deltas'; end if;
  for experience_delta in select value from jsonb_array_elements(experience_deltas) loop
    update public.creatures set experience = experience + (experience_delta ->> 'amount')::bigint
    where id = (experience_delta ->> 'creatureId')::uuid
      and character_id = (select character_id from public.character_hunts where hunt_id = expected_hunt_id);
  end loop;
  update public.character_hunts set active_creature_id = next_active_creature_id, active_creature_health = next_active_creature_health,
    player_position = next_player_position, enemies = next_enemies, wave = next_wave, next_event_at = next_event_time,
    combat_events = next_combat_events, ability_cooldowns = next_ability_cooldowns, runtime_snapshot = next_runtime_snapshot,
    revision = revision + 1, updated_at = now() where hunt_id = expected_hunt_id and revision = expected_revision returning revision into updated_revision;
  if not found then return query select false, null::bigint, false; return; end if;
  insert into public.character_hunt_checkpoint_receipts values (checkpoint_id, expected_hunt_id, expected_revision, '{}'::jsonb, updated_revision, false);
  return query select true, updated_revision, false;
end; $$;
revoke all on function public.checkpoint_character_hunt(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.checkpoint_character_hunt(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, boolean) to service_role;
