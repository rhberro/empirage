-- Creatures — the release of a creature.
--
-- "Soltar criatura" is the opposite of capturing it: the creature leaves the
-- storage of the trainer and is gone for good. It is a deletion, and it only
-- touches a creature that is not in the team — a creature in the team is
-- removed from the team first, and the release comes after.
--
-- The caller is the service role, which bypasses RLS, so the function needs no
-- definer rights: security invoker keeps it from being an escalation path.
-- The owner is checked against trainers.owner_id, because the service role
-- ignores RLS and would otherwise see every trainer of the game.

create or replace function public.release_creature(
  p_trainer_id uuid,
  p_owner_id uuid,
  p_creature_id uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serializes the operations of the same trainer until the transaction ends.
  perform 1
  from public.trainers
  where id = p_trainer_id and owner_id = p_owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'trainer_not_found';
  end if;

  delete from public.creatures
  where id = p_creature_id and trainer_id = p_trainer_id and not is_in_team;

  if not found then
    raise exception using errcode = 'P0001', message = 'creature_not_found';
  end if;

  return true;
end;
$$;

revoke execute on function public.release_creature(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_creature(uuid, uuid, uuid) to service_role;
