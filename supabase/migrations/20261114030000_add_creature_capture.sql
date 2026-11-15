alter table public.creatures
  add column if not exists rarity text generated always as (
    case
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 37 then 'common'
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 74 then 'uncommon'
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 111 then 'rare'
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 148 then 'epic'
      else 'legendary'
    end
  ) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'creatures_rarity_check'
      and conrelid = 'public.creatures'::regclass
  ) then
    alter table public.creatures
      add constraint creatures_rarity_check
      check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));
  end if;
end $$;

create table if not exists public.character_capture_configuration (
  character_id uuid primary key references public.characters (id) on delete cascade,
  item_id smallint not null references public.items (id),
  rarities text[] not null default array['common', 'uncommon', 'rare', 'epic', 'legendary']::text[],
  constraint character_capture_configuration_rarities_check check (
    cardinality(rarities) > 0
    and rarities <@ array['common', 'uncommon', 'rare', 'epic', 'legendary']::text[]
  )
);

create index if not exists character_capture_configuration_item_id_idx
on public.character_capture_configuration (item_id);

alter table public.character_capture_configuration enable row level security;
revoke all on public.character_capture_configuration from anon, authenticated;
grant select on public.character_capture_configuration to authenticated, service_role;
create policy capture_configuration_own on public.character_capture_configuration
for select to authenticated
using (
  exists (
    select 1 from public.characters
    where characters.id = character_capture_configuration.character_id
      and characters.user_id = (select auth.uid())
  )
);

create or replace function public.complete_character_capture(
  target_character_id uuid,
  target_item_id smallint,
  target_species_id smallint,
  target_level smallint,
  target_rarity text,
  target_gender text,
  target_iv_hp smallint,
  target_iv_attack smallint,
  target_iv_defense smallint,
  target_iv_special_attack smallint,
  target_iv_special_defense smallint,
  target_iv_speed smallint,
  capture_succeeded boolean
)
returns table (gold bigint, creature_id uuid, party_slot smallint)
language plpgsql security definer set search_path = '' as $$
declare
  available_party_slot smallint;
  created_creature_id uuid;
  resulting_gold bigint;
begin
  if target_level < 1
    or target_gender not in ('male', 'female')
    or target_iv_hp not between 0 and 31
    or target_iv_attack not between 0 and 31
    or target_iv_defense not between 0 and 31
    or target_iv_special_attack not between 0 and 31
    or target_iv_special_defense not between 0 and 31
    or target_iv_speed not between 0 and 31
  then
    raise exception using errcode = '22023', message = 'invalid_capture';
  end if;

  update public.characters as characters
  set gold = characters.gold - items.buy_price
  from public.items as items
  where characters.id = target_character_id
    and items.id = target_item_id
    and items.category = 'poke_ball'
    and items.buy_price > 0
    and characters.gold >= items.buy_price
  returning characters.gold into resulting_gold;

  if resulting_gold is null then
    return;
  end if;

  if capture_succeeded then
    select candidate.slot into available_party_slot
    from pg_catalog.generate_series(1, 6) as candidate(slot)
    where not exists (
      select 1 from public.creatures
      where creatures.character_id = target_character_id
        and creatures.party_slot = candidate.slot
    )
    order by candidate.slot
    limit 1;

    insert into public.creatures (
      character_id, species_id, party_slot, gender, experience,
      iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed
    ) values (
      target_character_id, target_species_id, available_party_slot, target_gender,
      (50::bigint * target_level * target_level * target_level - 150::bigint * target_level * target_level + 400::bigint * target_level) / 3,
      target_iv_hp, target_iv_attack, target_iv_defense,
      target_iv_special_attack, target_iv_special_defense, target_iv_speed
    ) returning id into created_creature_id;
  end if;

  return query select resulting_gold, created_creature_id, available_party_slot;
end;
$$;

revoke all on function public.complete_character_capture(uuid, smallint, smallint, smallint, text, text, smallint, smallint, smallint, smallint, smallint, smallint, boolean) from public, anon, authenticated;
grant execute on function public.complete_character_capture(uuid, smallint, smallint, smallint, text, text, smallint, smallint, smallint, smallint, smallint, smallint, boolean) to service_role;

create or replace function public.move_creature_to_party(target_creature_id uuid)
returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  target_character_id uuid;
  available_party_slot smallint;
begin
  select creatures.character_id into target_character_id
  from public.creatures
  join public.characters on characters.id = creatures.character_id
  where creatures.id = target_creature_id
    and characters.user_id = auth.uid()
  for update;

  if target_character_id is null then
    raise exception using errcode = '42501', message = 'creature_not_owned';
  end if;

  select candidate.slot into available_party_slot
  from pg_catalog.generate_series(1, 6) as candidate(slot)
  where not exists (
    select 1 from public.creatures
    where creatures.character_id = target_character_id
      and creatures.party_slot = candidate.slot
  )
  order by candidate.slot
  limit 1;

  if available_party_slot is null then
    raise exception using errcode = 'P0001', message = 'party_full';
  end if;

  update public.creatures
  set party_slot = available_party_slot
  where creatures.id = target_creature_id;

  return available_party_slot;
end;
$$;

create or replace function public.move_creature_to_storage(target_creature_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.creatures
  set party_slot = null
  where creatures.id = target_creature_id
    and exists (
      select 1 from public.characters
      where characters.id = creatures.character_id
        and characters.user_id = auth.uid()
    );

  if not found then
    raise exception using errcode = '42501', message = 'creature_not_owned';
  end if;
end;
$$;

revoke all on function public.move_creature_to_party(uuid), public.move_creature_to_storage(uuid) from public, anon;
grant execute on function public.move_creature_to_party(uuid), public.move_creature_to_storage(uuid) to authenticated;
