grant select on table
  public.character_hunts,
  public.characters,
  public.creatures,
  public.creature_species,
  public.hunting_locations,
  public.hunting_location_species
to service_role;

grant insert, update, delete on table public.character_hunts to service_role;

grant execute on function public.transition_character_hunt(
  uuid, bigint, uuid, integer, jsonb, jsonb, integer, timestamptz, uuid, bigint, boolean
) to service_role;
