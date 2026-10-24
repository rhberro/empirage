-- Creatures — the guard of the last creature.
--
-- A trainer must always keep at least one creature, and the team must not
-- become empty: the active creature of the game screen and the hunt both come
-- from the first team slot. The guard lives in the same transaction that
-- changes the rows, so two simultaneous commands cannot both pass it.
--
-- Both functions keep the signature and the return type they already had.
-- The refusal is an exception with a message the repository maps to an API
-- code: `last_creature` for the release of the last creature of the trainer
-- (or of the only member of the team) and `last_team_member` for taking the
-- only creature out of the team.
--
-- The caller is the service role, which bypasses RLS, so the functions need no
-- definer rights: security invoker keeps them from being an escalation path.
-- The owner is checked against trainers.owner_id, because the service role
-- ignores RLS and would otherwise see every trainer of the game.

create or replace function public.remove_creature_from_team(
  p_trainer_id uuid,
  p_owner_id uuid,
  p_creature_id uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_team_count int;
begin
  perform 1
  from public.trainers
  where id = p_trainer_id and owner_id = p_owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'trainer_not_found';
  end if;

  if not exists (
    select 1
    from public.creatures
    where id = p_creature_id and trainer_id = p_trainer_id and is_in_team
  ) then
    raise exception using errcode = 'P0001', message = 'creature_not_found';
  end if;

  select count(*) into v_team_count
  from public.creatures
  where trainer_id = p_trainer_id and is_in_team;

  if v_team_count <= 1 then
    raise exception using errcode = 'P0001', message = 'last_team_member';
  end if;

  update public.creatures
  set is_in_team = false, team_slot = null
  where id = p_creature_id and trainer_id = p_trainer_id and is_in_team;

  if not found then
    raise exception using errcode = 'P0001', message = 'creature_not_found';
  end if;

  return true;
end;
$$;

create or replace function public.release_creature(
  p_trainer_id uuid,
  p_owner_id uuid,
  p_creature_id uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_in_team boolean;
  v_team_count int;
  v_total_count int;
begin
  -- Serializes the operations of the same trainer until the transaction ends.
  perform 1
  from public.trainers
  where id = p_trainer_id and owner_id = p_owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'trainer_not_found';
  end if;

  select c.is_in_team into v_in_team
  from public.creatures c
  where c.id = p_creature_id and c.trainer_id = p_trainer_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'creature_not_found';
  end if;

  select count(*) into v_team_count
  from public.creatures
  where trainer_id = p_trainer_id and is_in_team;

  select count(*) into v_total_count
  from public.creatures
  where trainer_id = p_trainer_id;

  -- A creature in the team can be released only while another member stays:
  -- the release of the last member would leave the team without its active
  -- creature. A creature outside the team is guarded by the total count.
  if v_in_team and v_team_count <= 1 then
    raise exception using errcode = 'P0001', message = 'last_creature';
  end if;

  if v_total_count <= 1 then
    raise exception using errcode = 'P0001', message = 'last_creature';
  end if;

  delete from public.creatures
  where id = p_creature_id and trainer_id = p_trainer_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'creature_not_found';
  end if;

  return true;
end;
$$;

revoke execute on function public.remove_creature_from_team(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_creature_from_team(uuid, uuid, uuid) to service_role;

revoke execute on function public.release_creature(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_creature(uuid, uuid, uuid) to service_role;
