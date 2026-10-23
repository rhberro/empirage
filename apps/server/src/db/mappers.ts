import type {
  Creature,
  CreatureAbility,
  CreatureSpecies,
  Potential,
} from '@creatures/contracts/creature';
import type { InventoryItem } from '@creatures/contracts/inventory';
import type { TeamSlot } from '@creatures/contracts/player';
import type { Ability, Species, StarterSpecies } from '@creatures/contracts/species';
import type { Trainer } from '@creatures/contracts/trainer';

import { readEmbedded } from '~/db/embedded';
import type {
  AbilityFields,
  CreatureAbilityRow,
  CreatureRow,
  CreatureSpeciesRow,
  SpeciesAbilityRow,
  SpeciesRow,
  TrainerItemRow,
  TrainerRow,
} from '~/db/types';

const DEFAULT_POTENTIAL = 50;

export function mapTrainerRow(row: TrainerRow): Trainer {
  return {
    createdAt: row.created_at,
    diamonds: row.diamonds,
    gender: row.gender,
    gold: row.gold,
    id: row.id,
    level: row.level,
    name: row.name,
    staminaMinutes: row.stamina_minutes,
    starterSpeciesId: row.starter_species_id,
  };
}

export function mapCreatureRow(row: CreatureRow): Creature {
  return {
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    experience: row.experience,
    id: row.id,
    isInTeam: row.is_in_team,
    level: row.level,
    nickname: row.nickname,
    potential: mapPotential(row.potential),
    species: mapSpeciesSummary(row.species, row.species_id),
    speciesId: row.species_id,
    teamSlot: row.team_slot,
    trainerId: row.trainer_id,
  };
}

/**
 * The species of the creature, joined with the row.
 *
 * The join is on a foreign key with `on delete restrict`, so the species is
 * always there; the fallback only exists to keep the mapper total.
 */
export function mapSpeciesSummary(
  row: CreatureSpeciesRow | CreatureSpeciesRow[] | null,
  speciesId: string,
): CreatureSpecies {
  const species = readEmbedded(row);
  if (species === null) {
    return {
      baseMagicAttack: 0,
      baseMagicDefense: 0,
      basePhysicalAttack: 0,
      basePhysicalDefense: 0,
      baseVitality: 0,
      element: 'neutral',
      id: speciesId,
      name: '',
      slug: '',
    };
  }
  return {
    baseMagicAttack: species.base_magic_attack,
    baseMagicDefense: species.base_magic_defense,
    basePhysicalAttack: species.base_physical_attack,
    basePhysicalDefense: species.base_physical_defense,
    baseVitality: species.base_vitality,
    element: species.element,
    id: species.id,
    name: species.name,
    slug: species.slug,
  };
}

export function mapInventoryItem(row: TrainerItemRow): InventoryItem | null {
  const item = readEmbedded(row.items);
  if (item === null) {
    return null;
  }
  return {
    category: item.category,
    description: item.description,
    isStoreItem: item.is_store_item,
    itemId: item.id,
    name: item.name,
    price: item.price,
    quantity: row.quantity,
    slug: item.slug,
  };
}

export function mapCreatureAbilities(rows: CreatureAbilityRow[]): CreatureAbility[] {
  const abilities: CreatureAbility[] = [];
  const sorted = rows.toSorted(compareCreatureAbilityRows);
  for (const row of sorted) {
    const fields = readEmbedded(row.abilities);
    if (fields === null) {
      continue;
    }
    abilities.push({
      abilityId: fields.id,
      cooldownMs: fields.cooldown_ms,
      damage: fields.damage,
      description: fields.description,
      element: fields.element,
      name: fields.name,
      slot: row.slot,
      slug: fields.slug,
    });
  }
  return abilities;
}

export function mapPotential(value: unknown): Potential {
  const source = isRecord(value) ? value : {};
  return {
    magicAttack: readNumber(source, 'magicAttack'),
    magicDefense: readNumber(source, 'magicDefense'),
    physicalAttack: readNumber(source, 'physicalAttack'),
    physicalDefense: readNumber(source, 'physicalDefense'),
    vitality: readNumber(source, 'vitality'),
  };
}

export function mapAbilityFields(fields: AbilityFields): Ability {
  return {
    cooldownMs: fields.cooldown_ms,
    damage: fields.damage,
    description: fields.description,
    element: fields.element,
    id: fields.id,
    name: fields.name,
    slug: fields.slug,
  };
}

export function mapSpeciesRow(row: SpeciesRow, abilities: Ability[]): Species {
  return {
    abilities,
    baseExperience: row.base_experience,
    baseMagicAttack: row.base_magic_attack,
    baseMagicDefense: row.base_magic_defense,
    basePhysicalAttack: row.base_physical_attack,
    basePhysicalDefense: row.base_physical_defense,
    baseVitality: row.base_vitality,
    captureChance: Number(row.capture_chance),
    description: row.description,
    element: row.element,
    id: row.id,
    isStarter: row.is_starter,
    name: row.name,
    slug: row.slug,
  };
}

export function mapStarterSpeciesRows(
  speciesRows: SpeciesRow[],
  abilitiesBySpecies: Map<string, Ability[]>,
): StarterSpecies[] {
  const starters: StarterSpecies[] = [];
  for (const row of speciesRows) {
    const abilities = abilitiesBySpecies.get(row.id) ?? [];
    const species = mapSpeciesRow(row, abilities);
    starters.push({ ...species, isStarter: true });
  }
  return starters;
}

export function mapAbilitiesBySpecies(rows: SpeciesAbilityRow[]): Map<string, Ability[]> {
  const grouped = new Map<string, Ability[]>();
  const sorted = rows.toSorted(compareAbilityRows);
  for (const row of sorted) {
    const fields = readAbilityFields(row.abilities);
    if (fields === null) {
      continue;
    }
    const abilities = grouped.get(row.species_id) ?? [];
    abilities.push(mapAbilityFields(fields));
    grouped.set(row.species_id, abilities);
  }
  return grouped;
}

function readAbilityFields(value: AbilityFields | AbilityFields[] | null): AbilityFields | null {
  return readEmbedded(value);
}

function compareAbilityRows(first: SpeciesAbilityRow, second: SpeciesAbilityRow): number {
  return first.slot - second.slot;
}

/**
 * The primary species comes first, so the card of the area can draw the
 * creature that represents it without looking for it.
 */
function compareCreatureAbilityRows(first: CreatureAbilityRow, second: CreatureAbilityRow): number {
  return first.slot - second.slot;
}

export function mapTeamSlots(rows: CreatureRow[]): TeamSlot[] {
  const slots: TeamSlot[] = [];
  for (const row of rows) {
    if (row.team_slot === null) {
      continue;
    }
    slots.push({ creature: mapCreatureRow(row), slot: row.team_slot });
  }
  return slots;
}

export function mapCreatures(rows: CreatureRow[]): Creature[] {
  return rows.map(mapCreatureRow);
}

export function mapInventoryItems(rows: TrainerItemRow[]): InventoryItem[] {
  const items: InventoryItem[] = [];
  for (const row of rows) {
    const item = mapInventoryItem(row);
    if (item !== null) {
      items.push(item);
    }
  }
  return items;
}

/**
 * The mappers of the hunt areas live in their own module, and are re-exported
 * here so the database layer has a single import point.
 */
export {
  mapHuntAreaItem,
  mapHuntAreaRow,
  mapHuntAreaSpecies,
  sortHuntAreasByRecommendedLevel,
} from '~/db/huntAreaMappers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return DEFAULT_POTENTIAL;
}
