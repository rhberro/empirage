import { readEmbedded } from '~/db/embedded';
import type {
  HuntCreatureRow,
  HuntEquippedAbilityRow,
  HuntGearSlotRow,
} from '~/db/huntContentRepository';
import { mapPotential } from '~/db/mappers';
import { HuntStartError } from '~/hunt/errors';
import type { SimAbility, SimDevice, SimTeamMemberInput } from '~/hunt/sim';

import { mapAbility } from './contentMappers';

/**
 * The team of a trainer, ready to enter the field.
 */
export type HuntTeamLoad = {
  activeCreatureId: string;
  device: SimDevice | null;
  staminaMinutes: number;
  team: SimTeamMemberInput[];
};

const ABILITY_SLOT_COUNT = 4;
const CONSUMABLE_KIND = 'consumable';
const DEVICE_KIND = 'device';
const DEVICE_SLOT = 6;

/**
 * A creature of the team, with its four ability slots and its consumables.
 *
 * A consumable only exists for the creature when the item heals: the other
 * items of the trainer are not usable in the field.
 */
export function mapTeamMember(input: {
  abilityRows: HuntEquippedAbilityRow[];
  creature: HuntCreatureRow;
  gearRows: HuntGearSlotRow[];
  quantities: Map<string, number>;
}): SimTeamMemberInput {
  const { abilityRows, creature, gearRows, quantities } = input;
  const species = readEmbedded(creature.species);
  if (species === null) {
    throw new Error(`Creature ${creature.id} has no species`);
  }
  return {
    abilities: mapEquippedAbilities(abilityRows, creature.id),
    consumables: mapConsumables(gearRows, quantities),
    creatureId: creature.id,
    currentHp: creature.current_hp,
    experience: creature.experience,
    level: creature.level,
    potential: mapPotential(creature.potential),
    speciesSlug: species.slug,
    teamSlot: creature.team_slot ?? 1,
  };
}

/**
 * The team of a trainer, from the rows of the database.
 */
export function mapHuntTeam(input: {
  abilityRows: HuntEquippedAbilityRow[];
  gearRows: HuntGearSlotRow[];
  quantities: Map<string, number>;
  staminaMinutes: number;
  teamRows: HuntCreatureRow[];
}): HuntTeamLoad {
  const { abilityRows, gearRows, quantities, staminaMinutes, teamRows } = input;
  const rows = teamRows.toSorted(compareTeamRows);
  const team: SimTeamMemberInput[] = [];
  for (const row of rows) {
    team.push(mapTeamMember({ abilityRows, creature: row, gearRows, quantities }));
  }
  if (team.length === 0) {
    throw new HuntStartError('no_viable_creature');
  }
  return {
    activeCreatureId: readActiveCreatureId(rows, team),
    device: mapDevice(gearRows, quantities),
    staminaMinutes,
    team,
  };
}

function mapDevice(rows: HuntGearSlotRow[], quantities: Map<string, number>): SimDevice | null {
  for (const row of rows) {
    if (row.kind !== DEVICE_KIND || row.slot !== DEVICE_SLOT) {
      continue;
    }
    const item = readEmbedded(row.items);
    if (item === null) {
      continue;
    }
    return {
      itemId: item.id,
      multiplier: Number(item.capture_multiplier),
      name: item.name,
      quantity: quantities.get(item.id) ?? 0,
      slot: row.slot,
    };
  }
  return null;
}

function mapEquippedAbilities(
  rows: HuntEquippedAbilityRow[],
  creatureId: string,
): (SimAbility | null)[] {
  const abilities: (SimAbility | null)[] = [];
  for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot += 1) {
    abilities.push(null);
  }
  for (const row of rows.toSorted(compareEquippedAbilityRows)) {
    if (row.creature_id !== creatureId || row.slot < 0 || row.slot >= ABILITY_SLOT_COUNT) {
      continue;
    }
    const fields = readEmbedded(row.abilities);
    abilities[row.slot] = fields === null ? null : mapAbility(fields);
  }
  return abilities;
}

function mapConsumables(
  rows: HuntGearSlotRow[],
  quantities: Map<string, number>,
): SimTeamMemberInput['consumables'] {
  const consumables: SimTeamMemberInput['consumables'] = [];
  for (const row of rows.toSorted(compareGearRows)) {
    if (row.kind !== CONSUMABLE_KIND || row.trigger_hp_percent === null) {
      continue;
    }
    if (row.slot !== 4 && row.slot !== 5) {
      continue;
    }
    const item = readEmbedded(row.items);
    if (item === null || item.heal_percent === null) {
      continue;
    }
    consumables.push({
      cooldownMs: item.cooldown_ms,
      healPercent: item.heal_percent,
      itemId: item.id,
      name: item.name,
      quantity: quantities.get(item.id) ?? 0,
      slot: row.slot,
      triggerHpPercent: row.trigger_hp_percent,
    });
  }
  return consumables;
}

function readActiveCreatureId(rows: HuntCreatureRow[], team: SimTeamMemberInput[]): string {
  for (const row of rows) {
    if (row.team_slot === 1) {
      return row.id;
    }
  }
  for (const member of team) {
    if (member.currentHp === null || member.currentHp > 0) {
      return member.creatureId;
    }
  }
  return team[0]?.creatureId ?? '';
}

function compareEquippedAbilityRows(
  left: HuntEquippedAbilityRow,
  right: HuntEquippedAbilityRow,
): number {
  if (left.creature_id !== right.creature_id) {
    return left.creature_id.localeCompare(right.creature_id);
  }
  return left.slot - right.slot;
}

function compareGearRows(left: HuntGearSlotRow, right: HuntGearSlotRow): number {
  return left.slot - right.slot;
}

function compareTeamRows(left: HuntCreatureRow, right: HuntCreatureRow): number {
  return (left.team_slot ?? Number.MAX_SAFE_INTEGER) - (right.team_slot ?? Number.MAX_SAFE_INTEGER);
}
