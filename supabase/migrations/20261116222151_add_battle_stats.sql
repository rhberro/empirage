create table public.natures (
  slug text primary key,
  name text not null unique,
  increased_stat text,
  decreased_stat text,
  constraint natures_stat_check check (
    (increased_stat is null and decreased_stat is null)
    or (
      increased_stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')
      and decreased_stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')
      and increased_stat <> decreased_stat
    )
  )
);

insert into public.natures (slug, name, increased_stat, decreased_stat) values
  ('hardy', 'Hardy', null, null), ('lonely', 'Lonely', 'attack', 'defense'),
  ('brave', 'Brave', 'attack', 'speed'), ('adamant', 'Adamant', 'attack', 'special_attack'),
  ('naughty', 'Naughty', 'attack', 'special_defense'), ('bold', 'Bold', 'defense', 'attack'),
  ('docile', 'Docile', null, null), ('relaxed', 'Relaxed', 'defense', 'speed'),
  ('impish', 'Impish', 'defense', 'special_attack'), ('lax', 'Lax', 'defense', 'special_defense'),
  ('timid', 'Timid', 'speed', 'attack'), ('hasty', 'Hasty', 'speed', 'defense'),
  ('serious', 'Serious', null, null), ('jolly', 'Jolly', 'speed', 'special_attack'),
  ('naive', 'Naive', 'speed', 'special_defense'), ('modest', 'Modest', 'special_attack', 'attack'),
  ('mild', 'Mild', 'special_attack', 'defense'), ('quiet', 'Quiet', 'special_attack', 'speed'),
  ('bashful', 'Bashful', null, null), ('rash', 'Rash', 'special_attack', 'special_defense'),
  ('calm', 'Calm', 'special_defense', 'attack'), ('gentle', 'Gentle', 'special_defense', 'defense'),
  ('sassy', 'Sassy', 'special_defense', 'speed'), ('careful', 'Careful', 'special_defense', 'special_attack'),
  ('quirky', 'Quirky', null, null);

alter table public.species
  add column ev_yield_hp smallint not null default 0 check (ev_yield_hp between 0 and 3),
  add column ev_yield_attack smallint not null default 0 check (ev_yield_attack between 0 and 3),
  add column ev_yield_defense smallint not null default 0 check (ev_yield_defense between 0 and 3),
  add column ev_yield_special_attack smallint not null default 0 check (ev_yield_special_attack between 0 and 3),
  add column ev_yield_special_defense smallint not null default 0 check (ev_yield_special_defense between 0 and 3),
  add column ev_yield_speed smallint not null default 0 check (ev_yield_speed between 0 and 3),
  add constraint species_ev_yield_total_check check (
    ev_yield_hp + ev_yield_attack + ev_yield_defense + ev_yield_special_attack + ev_yield_special_defense + ev_yield_speed <= 3
  );

alter table public.creatures
  add column nature_slug text references public.natures (slug),
  add column ev_hp smallint not null default 0 check (ev_hp between 0 and 252),
  add column ev_attack smallint not null default 0 check (ev_attack between 0 and 252),
  add column ev_defense smallint not null default 0 check (ev_defense between 0 and 252),
  add column ev_special_attack smallint not null default 0 check (ev_special_attack between 0 and 252),
  add column ev_special_defense smallint not null default 0 check (ev_special_defense between 0 and 252),
  add column ev_speed smallint not null default 0 check (ev_speed between 0 and 252),
  add constraint creatures_ev_total_check check (
    ev_hp + ev_attack + ev_defense + ev_special_attack + ev_special_defense + ev_speed <= 510
  );

update public.creatures
set nature_slug = (array['hardy', 'lonely', 'brave', 'adamant', 'naughty', 'bold', 'docile', 'relaxed', 'impish', 'lax', 'timid', 'hasty', 'serious', 'jolly', 'naive', 'modest', 'mild', 'quiet', 'bashful', 'rash', 'calm', 'gentle', 'sassy', 'careful', 'quirky'])[1 + floor(random() * 25)::integer]
where nature_slug is null;

alter table public.creatures alter column nature_slug set not null;
alter table public.creatures alter column nature_slug set default (array['hardy', 'lonely', 'brave', 'adamant', 'naughty', 'bold', 'docile', 'relaxed', 'impish', 'lax', 'timid', 'hasty', 'serious', 'jolly', 'naive', 'modest', 'mild', 'quiet', 'bashful', 'rash', 'calm', 'gentle', 'sassy', 'careful', 'quirky'])[1 + floor(random() * 25)::integer];

create table public.move_stat_effects (
  move_id smallint not null references public.moves (id) on delete cascade,
  stat text not null check (stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed', 'accuracy', 'evasion')),
  stage smallint not null check (stage between -6 and 6 and stage <> 0),
  chance smallint not null check (chance between 1 and 100),
  target text not null check (target in ('user', 'target')),
  primary key (move_id, stat, target)
);

alter table public.natures enable row level security;
alter table public.move_stat_effects enable row level security;
revoke all on public.natures, public.move_stat_effects from anon, authenticated;
grant select on public.natures, public.move_stat_effects to authenticated;
create policy natures_read on public.natures for select to authenticated using (true);
create policy move_stat_effects_read on public.move_stat_effects for select to authenticated using (true);

create or replace function public.give_starter_creature(target_character_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_creature_id uuid;
begin
  insert into public.creatures (
    character_id, species_id, party_slot, gender, nature_slug,
    iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed
  ) values (
    target_character_id, (array[1, 4, 7])[1 + floor(random() * 3)::integer], 1,
    case when random() < .5 then 'male' else 'female' end,
    (array['hardy', 'lonely', 'brave', 'adamant', 'naughty', 'bold', 'docile', 'relaxed', 'impish', 'lax', 'timid', 'hasty', 'serious', 'jolly', 'naive', 'modest', 'mild', 'quiet', 'bashful', 'rash', 'calm', 'gentle', 'sassy', 'careful', 'quirky'])[1 + floor(random() * 25)::integer],
    15, 15, 15, 15, 15, 15
  ) returning id into created_creature_id;
  return created_creature_id;
end;
$$;

create function public.checkpoint_character_hunt_v2(
  expected_hunt_id uuid, expected_revision bigint, checkpoint_id uuid, next_active_creature_id uuid,
  next_active_creature_health integer, next_player_position jsonb, next_enemies jsonb, next_wave integer,
  next_event_time timestamptz, next_combat_events jsonb, next_ability_cooldowns jsonb, next_runtime_snapshot jsonb,
  experience_deltas jsonb default '[]'::jsonb, effort_values jsonb default '{}'::jsonb, finish_hunt boolean default false
)
returns table (applied boolean, next_revision bigint, finished boolean)
language plpgsql security definer set search_path = '' as $$
declare
  completion public.character_hunt_completion_commands%rowtype;
  locked_hunt public.character_hunts%rowtype;
  experience_delta jsonb;
  effort_value record;
  updated_revision bigint;
begin
  if expected_hunt_id is null or expected_revision is null or expected_revision < 1 or checkpoint_id is null then
    raise exception using errcode = '22023', message = 'invalid_checkpoint_identity';
  end if;
  if experience_deltas is null or jsonb_typeof(experience_deltas) <> 'array' or effort_values is null or jsonb_typeof(effort_values) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_checkpoint_payload';
  end if;
  delete from public.character_hunt_completion_commands as expired_command
  where expired_command.checkpoint_id in (
    select candidate.checkpoint_id from public.character_hunt_completion_commands as candidate
    where candidate.expires_at < now() order by candidate.expires_at limit 100
  );
  select * into completion from public.character_hunt_completion_commands as command
  where command.checkpoint_id = checkpoint_character_hunt_v2.checkpoint_id;
  if found then
    if not finish_hunt or completion.hunt_id <> expected_hunt_id or completion.expected_revision <> expected_revision then
      raise exception using errcode = '22023', message = 'checkpoint_identity_mismatch';
    end if;
    return query select true, completion.resulting_revision, true;
    return;
  end if;
  select * into locked_hunt from public.character_hunts where character_hunts.hunt_id = expected_hunt_id for update;
  if not found then return query select false, null::bigint, false; return; end if;
  if locked_hunt.last_checkpoint_id = checkpoint_id then return query select true, locked_hunt.revision, false; return; end if;
  if locked_hunt.revision <> expected_revision then return query select false, null::bigint, false; return; end if;
  for experience_delta in select value from jsonb_array_elements(experience_deltas) order by value ->> 'creatureId' loop
    if jsonb_typeof(experience_delta) <> 'object'
      or (experience_delta ->> 'creatureId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or (experience_delta ->> 'amount') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid_experience_delta';
    end if;
    update public.creatures set experience = creatures.experience + (experience_delta ->> 'amount')::bigint
    where creatures.id = (experience_delta ->> 'creatureId')::uuid and creatures.character_id = locked_hunt.character_id;
  end loop;
  for effort_value in select key, value from jsonb_each(effort_values) order by key loop
    if effort_value.key !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(effort_value.value) <> 'object'
      or effort_value.value ->> 'evHealth' !~ '^[0-9]+$'
      or effort_value.value ->> 'evAttack' !~ '^[0-9]+$'
      or effort_value.value ->> 'evDefense' !~ '^[0-9]+$'
      or effort_value.value ->> 'evSpecialAttack' !~ '^[0-9]+$'
      or effort_value.value ->> 'evSpecialDefense' !~ '^[0-9]+$'
      or effort_value.value ->> 'evSpeed' !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid_effort_values';
    end if;
    update public.creatures set
      ev_hp = (effort_value.value ->> 'evHealth')::smallint,
      ev_attack = (effort_value.value ->> 'evAttack')::smallint,
      ev_defense = (effort_value.value ->> 'evDefense')::smallint,
      ev_special_attack = (effort_value.value ->> 'evSpecialAttack')::smallint,
      ev_special_defense = (effort_value.value ->> 'evSpecialDefense')::smallint,
      ev_speed = (effort_value.value ->> 'evSpeed')::smallint
    where creatures.id = effort_value.key::uuid and creatures.character_id = locked_hunt.character_id;
  end loop;
  update public.characters set active_creature_id = next_active_creature_id
  where id = locked_hunt.character_id and exists (
    select 1 from public.creatures where creatures.id = next_active_creature_id
      and creatures.character_id = locked_hunt.character_id and creatures.party_slot is not null
  );
  if finish_hunt then
    delete from public.character_hunts where character_hunts.hunt_id = expected_hunt_id;
    insert into public.character_hunt_completion_commands (checkpoint_id, hunt_id, expected_revision, resulting_revision)
    values (checkpoint_character_hunt_v2.checkpoint_id, expected_hunt_id, expected_revision, expected_revision + 1);
    return query select true, expected_revision + 1, true;
    return;
  end if;
  update public.character_hunts set active_creature_id = next_active_creature_id,
    active_creature_health = next_active_creature_health, player_position = next_player_position,
    enemies = next_enemies, wave = next_wave, next_event_at = next_event_time, combat_events = next_combat_events,
    ability_cooldowns = next_ability_cooldowns, runtime_snapshot = next_runtime_snapshot, revision = revision + 1,
    updated_at = now(), last_checkpoint_id = checkpoint_character_hunt_v2.checkpoint_id
  where character_hunts.hunt_id = expected_hunt_id returning revision into updated_revision;
  return query select true, updated_revision, false;
end;
$$;

revoke all on function public.checkpoint_character_hunt_v2(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.checkpoint_character_hunt_v2(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) to service_role;
