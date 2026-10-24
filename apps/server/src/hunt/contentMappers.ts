import type { HuntMap } from '@creatures/contracts/huntMap';

import { readEmbedded } from '~/db/embedded';
import type {
  HuntAbilityRow,
  HuntDropRow,
  HuntEffectivenessRow,
  HuntSpeciesAbilityRow,
  HuntSpeciesRow,
} from '~/db/huntContentRepository';
import type {
  SimAbility,
  SimAttributeSet,
  SimContent,
  SimDrop,
  SimSpecies,
  SimSpeciesAbility,
} from '~/hunt/sim';

/**
 * The content of a hunt area, ready for the simulation.
 */
export type HuntAreaContent = {
  areaId: string;
  areaName: string;
  areaSlug: string;
  content: SimContent;
  minimumLevel: number;
  recommendedLevel: number;
};

/**
 * The ability fields of a row, reduced to what the simulation reads.
 */
export function mapAbility(row: HuntAbilityRow): SimAbility {
  return {
    areaLength: row.area_length,
    areaRadius: row.area_radius,
    areaShape: row.area_shape,
    areaStepMs: row.area_step_ms,
    cooldownMs: row.cooldown_ms,
    damage: row.damage,
    element: row.element,
    name: row.name,
    range: row.range,
    slug: row.slug,
    targetType: row.target_type,
    travelMs: row.travel_ms,
  };
}

/**
 * One ability of a species, with the chance and the interval of the wild use.
 */
export function mapSpeciesAbility(row: HuntSpeciesAbilityRow): SimSpeciesAbility | null {
  const fields = readEmbedded(row.abilities);
  if (fields === null) {
    return null;
  }
  return {
    ability: mapAbility(fields),
    wildChance: row.wild_chance,
    wildIntervalMs: row.wild_interval_ms,
  };
}

/**
 * One drop of a species.
 */
export function mapDropRow(row: HuntDropRow): SimDrop | null {
  const item = readEmbedded(row.items);
  if (item === null) {
    return null;
  }
  return { chance: row.chance, itemId: item.id, name: item.name };
}

/**
 * One species, with its abilities and its drops.
 */
export function mapSpeciesRow(
  row: HuntSpeciesRow,
  abilities: SimSpeciesAbility[],
  drops: SimDrop[],
): SimSpecies {
  const base: SimAttributeSet = {
    magicAttack: row.base_magic_attack,
    magicDefense: row.base_magic_defense,
    physicalAttack: row.base_physical_attack,
    physicalDefense: row.base_physical_defense,
    vitality: row.base_vitality,
  };
  return {
    abilities,
    base,
    baseExperience: row.base_experience,
    captureChance: Number(row.capture_chance),
    drops,
    element: row.element,
    name: row.name,
    slug: row.slug,
  };
}

/**
 * The key of the effectiveness table, in the shape the simulation reads.
 */
export function mapEffectivenessRow(row: HuntEffectivenessRow): { key: string; value: number } {
  return { key: `${row.attacker_element}:${row.defender_element}`, value: row.multiplier };
}

/**
 * The whole content of an area.
 *
 * Every list is ordered here and not by the database: two servers have to draw
 * the same numbers from the same row set.
 */
export function mapHuntAreaContent(input: {
  abilityRows: HuntSpeciesAbilityRow[];
  area: {
    id: string;
    minimum_level: number;
    name: string;
    recommended_level: number;
    slug: string;
  };
  dropRows: HuntDropRow[];
  effectivenessRows: HuntEffectivenessRow[];
  map: HuntMap;
  speciesRows: HuntSpeciesRow[];
}): HuntAreaContent {
  const { abilityRows, area, dropRows, effectivenessRows, map, speciesRows } = input;
  const abilitiesBySpecies = groupSpeciesAbilities(abilityRows);
  const dropsBySpecies = groupDrops(dropRows);
  const species: Record<string, SimSpecies> = {};
  for (const row of speciesRows.toSorted(compareSpeciesRows)) {
    species[row.slug] = mapSpeciesRow(
      row,
      abilitiesBySpecies.get(row.id) ?? [],
      dropsBySpecies.get(row.id) ?? [],
    );
  }
  return {
    areaId: area.id,
    areaName: area.name,
    areaSlug: area.slug,
    content: { effectiveness: buildEffectiveness(effectivenessRows), map, species },
    minimumLevel: area.minimum_level,
    recommendedLevel: area.recommended_level,
  };
}

function buildEffectiveness(rows: HuntEffectivenessRow[]): Record<string, number> {
  const effectiveness: Record<string, number> = {};
  for (const row of rows.toSorted(compareEffectivenessRows)) {
    const entry = mapEffectivenessRow(row);
    effectiveness[entry.key] = entry.value;
  }
  return effectiveness;
}

function groupSpeciesAbilities(rows: HuntSpeciesAbilityRow[]): Map<string, SimSpeciesAbility[]> {
  const grouped = new Map<string, SimSpeciesAbility[]>();
  for (const row of rows.toSorted(compareSpeciesAbilityRows)) {
    const ability = mapSpeciesAbility(row);
    if (ability === null) {
      continue;
    }
    const list = grouped.get(row.species_id) ?? [];
    list.push(ability);
    grouped.set(row.species_id, list);
  }
  return grouped;
}

function groupDrops(rows: HuntDropRow[]): Map<string, SimDrop[]> {
  const grouped = new Map<string, SimDrop[]>();
  for (const row of rows.toSorted(compareDropRows)) {
    const drop = mapDropRow(row);
    if (drop === null) {
      continue;
    }
    const list = grouped.get(row.species_id) ?? [];
    list.push(drop);
    grouped.set(row.species_id, list);
  }
  return grouped;
}

function compareSpeciesRows(left: HuntSpeciesRow, right: HuntSpeciesRow): number {
  return left.slug.localeCompare(right.slug);
}

function compareSpeciesAbilityRows(
  left: HuntSpeciesAbilityRow,
  right: HuntSpeciesAbilityRow,
): number {
  if (left.species_id !== right.species_id) {
    return left.species_id.localeCompare(right.species_id);
  }
  return left.slot - right.slot;
}

function compareDropRows(left: HuntDropRow, right: HuntDropRow): number {
  if (left.species_id !== right.species_id) {
    return left.species_id.localeCompare(right.species_id);
  }
  return readItemId(left).localeCompare(readItemId(right));
}

function compareEffectivenessRows(left: HuntEffectivenessRow, right: HuntEffectivenessRow): number {
  const leftKey = `${left.attacker_element}:${left.defender_element}`;
  const rightKey = `${right.attacker_element}:${right.defender_element}`;
  return leftKey.localeCompare(rightKey);
}

function readItemId(row: HuntDropRow): string {
  return readEmbedded(row.items)?.id ?? '';
}
