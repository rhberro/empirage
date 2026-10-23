import type { Creature, CreatureAbility } from '@creatures/contracts/creature';
import type { InventoryItem } from '@creatures/contracts/inventory';
import type { TeamSlot } from '@creatures/contracts/player';
import type { CreatureVitals } from '@creatures/contracts/skill';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapCreatureAbilities, mapCreatures, mapInventoryItems, mapTeamSlots } from '~/db/mappers';
import { mapCreatureVitals } from '~/db/skillLoadoutMappers';
import { readRows } from '~/db/trainerRepository';
import type {
  CreatureAbilityRow,
  CreatureRow,
  CreatureVitalsRow,
  TrainerItemRow,
} from '~/db/types';

const CREATURE_COLUMNS =
  'id, trainer_id, species_id, nickname, level, experience, potential, is_in_team, team_slot, captured_at, created_at, species(id, slug, name, element, base_vitality, base_physical_attack, base_magic_attack, base_physical_defense, base_magic_defense)';
const BACKPACK_COLUMNS =
  'item_id, quantity, items(id, slug, name, category, description, price, is_store_item)';
const ABILITY_COLUMNS =
  'slot, abilities(id, slug, name, element, damage, cooldown_ms, description)';
const VITALS_COLUMNS = 'current_hp, level, potential, species(base_vitality)';

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export function listTeamCreatures(admin: SupabaseClient, trainerId: string): Promise<TeamSlot[]> {
  const query = admin
    .from('creatures')
    .select(CREATURE_COLUMNS)
    .eq('trainer_id', trainerId)
    .eq('is_in_team', true)
    .order('team_slot', { ascending: true });
  return Promise.resolve(query.then(readTeamRows));
}

/**
 * The captured creatures that are not in the team, the most recent capture
 * first: the storage reads from the top down.
 */
export function listStorageCreatures(
  admin: SupabaseClient,
  trainerId: string,
): Promise<Creature[]> {
  const query = admin
    .from('creatures')
    .select(CREATURE_COLUMNS)
    .eq('trainer_id', trainerId)
    .eq('is_in_team', false)
    .order('captured_at', { ascending: false });
  return Promise.resolve(query.then(readStorageRows));
}

/**
 * The items the trainer owns. The rows with no quantity left are not items
 * the trainer has, so they do not show up in the backpack.
 */
export function listBackpackItems(
  admin: SupabaseClient,
  trainerId: string,
): Promise<InventoryItem[]> {
  const query = admin
    .from('trainer_items')
    .select(BACKPACK_COLUMNS)
    .eq('trainer_id', trainerId)
    .gt('quantity', 0)
    .order('items(name)', { ascending: true });
  return Promise.resolve(query.then(readBackpackRows));
}

/**
 * The abilities of a species, in the slot each one occupies.
 */
export function listSpeciesAbilities(
  admin: SupabaseClient,
  speciesId: string,
): Promise<CreatureAbility[]> {
  const query = admin
    .from('species_abilities')
    .select(ABILITY_COLUMNS)
    .eq('species_id', speciesId)
    .order('slot', { ascending: true });
  return Promise.resolve(query.then(readAbilityRows));
}

/**
 * The life of the creature in the field: the creature of the first slot of the
 * team.
 */
export function readActiveVitals(
  admin: SupabaseClient,
  trainerId: string,
): Promise<CreatureVitals | null> {
  const query = admin
    .from('creatures')
    .select(VITALS_COLUMNS)
    .eq('trainer_id', trainerId)
    .eq('is_in_team', true)
    .order('team_slot', { ascending: true })
    .limit(1)
    .maybeSingle();
  return Promise.resolve(query.then(readVitalsRow));
}

function readTeamRows(result: QueryResult<CreatureRow[]>): TeamSlot[] {
  const rows = readRows<CreatureRow>(result.data, result.error);
  return mapTeamSlots(rows);
}

function readStorageRows(result: QueryResult<CreatureRow[]>): Creature[] {
  const rows = readRows<CreatureRow>(result.data, result.error);
  return mapCreatures(rows);
}

function readBackpackRows(result: QueryResult<TrainerItemRow[]>): InventoryItem[] {
  const rows = readRows<TrainerItemRow>(result.data, result.error);
  return mapInventoryItems(rows);
}

function readAbilityRows(result: QueryResult<CreatureAbilityRow[]>): CreatureAbility[] {
  const rows = readRows<CreatureAbilityRow>(result.data, result.error);
  return mapCreatureAbilities(rows);
}

function readVitalsRow(result: QueryResult<CreatureVitalsRow>): CreatureVitals | null {
  if (result.error !== null) {
    throw new Error(`Creature vitals lookup failed: ${result.error.message}`);
  }
  if (result.data === null) {
    return null;
  }
  return mapCreatureVitals(result.data);
}
