import type {
  EquippedAbility,
  EquippedConsumable,
  EquippedDevice,
  SkillSlot,
} from '@creatures/contracts/skill';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  mapEquippedAbilities,
  mapEquippedConsumables,
  mapEquippedDevice,
} from '~/db/skillLoadoutMappers';
import { readRows } from '~/db/trainerRepository';
import type {
  CreatureAbilitySlotRow,
  DatabaseError,
  TrainerGearSlotRow,
  TrainerItemQuantityRow,
} from '~/db/types';

const ABILITY_SLOT_COLUMNS =
  'slot, abilities(id, slug, name, element, damage, cooldown_ms, description)';
const GEAR_SLOT_COLUMNS = 'slot, kind, item_id, trigger_hp_percent, items(id, name)';
const SET_ABILITY_SLOTS_FUNCTION = 'set_creature_ability_slots';

export type GearSlotKind = 'consumable' | 'device';

export type GearSlotWrite = {
  itemId: string;
  kind: GearSlotKind;
  slot: SkillSlot;
  triggerHpPercent: number | null;
  trainerId: string;
};

/** The loadout of the trainer: the two consumable slots and the device slot. */
export type TrainerGear = {
  consumables: EquippedConsumable[];
  device: EquippedDevice | null;
};

type QueryResult<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

/**
 * The abilities equipped in the four ability slots of a creature.
 */
export function listEquippedAbilities(
  admin: SupabaseClient,
  creatureId: string,
): Promise<EquippedAbility[]> {
  const query = admin
    .from('creature_ability_slots')
    .select(ABILITY_SLOT_COLUMNS)
    .eq('creature_id', creatureId)
    .order('slot', { ascending: true });
  return Promise.resolve(query.then(readAbilityRows));
}

/**
 * The abilities a species has, in the slot the species declares them.
 */
export function listSpeciesAbilityIds(admin: SupabaseClient, speciesId: string): Promise<string[]> {
  const query = admin.from('species_abilities').select('ability_id').eq('species_id', speciesId);
  return Promise.resolve(query.then(readAbilityIds));
}

/**
 * The species of a creature of the trainer, or null when the creature is not
 * his.
 */
export function findCreatureSpeciesId(
  admin: SupabaseClient,
  trainerId: string,
  creatureId: string,
): Promise<string | null> {
  const query = admin
    .from('creatures')
    .select('species_id')
    .eq('id', creatureId)
    .eq('trainer_id', trainerId)
    .maybeSingle();
  return Promise.resolve(query.then(readSpeciesId));
}

/**
 * Rewrites the ability slots of a creature. The rows that are missing are
 * created and the ones that are left over are removed, in one transaction.
 *
 * The list is the loadout in the order of the slots, and a null is an empty
 * slot: the position of the entry is the slot it occupies.
 */
export function writeCreatureAbilitySlots(
  admin: SupabaseClient,
  creatureId: string,
  ownerId: string,
  abilityIds: (string | null)[],
): Promise<DatabaseError | null> {
  const args = {
    p_ability_ids: abilityIds,
    p_creature_id: creatureId,
    p_owner_id: ownerId,
  };
  return Promise.resolve(admin.rpc(SET_ABILITY_SLOTS_FUNCTION, args).then(readOutcome));
}

/**
 * The slots of the skill bar that belong to the trainer.
 */
export function listTrainerGearSlots(
  admin: SupabaseClient,
  trainerId: string,
): Promise<TrainerGearSlotRow[]> {
  const query = admin
    .from('trainer_gear_slots')
    .select(GEAR_SLOT_COLUMNS)
    .eq('trainer_id', trainerId)
    .order('slot', { ascending: true });
  return Promise.resolve(query.then(readGearRows));
}

/**
 * How much of each item the trainer owns. The item that is not in the backpack
 * is a quantity of zero.
 */
export function readItemQuantities(
  admin: SupabaseClient,
  trainerId: string,
): Promise<Map<string, number>> {
  const query = admin.from('trainer_items').select('item_id, quantity').eq('trainer_id', trainerId);
  return Promise.resolve(query.then(readQuantityRows));
}

/**
 * The loadout of the trainer, read as the contract of the skill bar.
 */
export function readTrainerGear(admin: SupabaseClient, trainerId: string): Promise<TrainerGear> {
  return Promise.all([
    listTrainerGearSlots(admin, trainerId),
    readItemQuantities(admin, trainerId),
  ]).then(function buildGear(reads: [TrainerGearSlotRow[], Map<string, number>]): TrainerGear {
    const [rows, quantities] = reads;
    return {
      consumables: mapEquippedConsumables(rows, quantities),
      device: mapEquippedDevice(rows, quantities),
    };
  });
}

/**
 * The category of an item of the catalog, or null when the item does not
 * exist.
 */
export function findItemCategory(admin: SupabaseClient, itemId: string): Promise<string | null> {
  const query = admin.from('items').select('category').eq('id', itemId).maybeSingle();
  return Promise.resolve(query.then(readItemCategory));
}

/**
 * Puts an item in a slot of the skill bar of the trainer.
 */
export function writeTrainerGearSlot(
  admin: SupabaseClient,
  write: GearSlotWrite,
): Promise<DatabaseError | null> {
  const row = {
    item_id: write.itemId,
    kind: write.kind,
    slot: write.slot,
    trainer_id: write.trainerId,
    trigger_hp_percent: write.triggerHpPercent,
  };
  const query = admin.from('trainer_gear_slots').upsert(row, { onConflict: 'trainer_id,slot' });
  return Promise.resolve(query.then(readOutcome));
}

/**
 * Empties a slot of the skill bar of the trainer.
 */
export function deleteTrainerGearSlot(
  admin: SupabaseClient,
  trainerId: string,
  slot: SkillSlot,
): Promise<DatabaseError | null> {
  const query = admin
    .from('trainer_gear_slots')
    .delete()
    .eq('trainer_id', trainerId)
    .eq('slot', slot);
  return Promise.resolve(query.then(readOutcome));
}

function readAbilityRows(result: QueryResult<CreatureAbilitySlotRow[]>): EquippedAbility[] {
  const rows = readRows<CreatureAbilitySlotRow>(result.data, result.error);
  return mapEquippedAbilities(rows);
}

function readAbilityIds(result: QueryResult<{ ability_id: string }[]>): string[] {
  const rows = readRows<{ ability_id: string }>(result.data, result.error);
  return rows.map(readAbilityId);
}

function readAbilityId(row: { ability_id: string }): string {
  return row.ability_id;
}

function readSpeciesId(result: QueryResult<{ species_id: string }>): string | null {
  if (result.error !== null) {
    throw new Error(`Creature lookup failed: ${result.error.message}`);
  }
  return result.data === null ? null : result.data.species_id;
}

function readGearRows(result: QueryResult<TrainerGearSlotRow[]>): TrainerGearSlotRow[] {
  return readRows<TrainerGearSlotRow>(result.data, result.error);
}

function readQuantityRows(result: QueryResult<TrainerItemQuantityRow[]>): Map<string, number> {
  const rows = readRows<TrainerItemQuantityRow>(result.data, result.error);
  const quantities = new Map<string, number>();
  for (const row of rows) {
    quantities.set(row.item_id, row.quantity);
  }
  return quantities;
}

function readItemCategory(result: QueryResult<{ category: string }>): string | null {
  if (result.error !== null) {
    throw new Error(`Item lookup failed: ${result.error.message}`);
  }
  return result.data === null ? null : result.data.category;
}

function readOutcome(result: QueryResult<unknown>): DatabaseError | null {
  if (result.error === null) {
    return null;
  }
  return { code: result.error.code, message: result.error.message };
}
