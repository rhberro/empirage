/* eslint-disable max-lines-per-function, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadCharacterCaptureResources,
  type CaptureItemResource,
  type CharacterCaptureResources,
} from './capture-items.ts';
import {
  loadCharacterHealingResources,
  type CharacterHealingResources,
  type HealingItemResource,
} from './healing-items.ts';
import { uniqueNumbers } from './hunt-resource-values.ts';
import type { HuntAbilityCategory } from './hunt-resources.ts';

type CityCreatureRow = { id: string; level: number; species_id: number };
type CityEquippedMoveRow = { creature_id: string; move_id: number; slot: number };
type CityLearnsetRow = { move_id: number; required_level: number; species_id: number };
type CityMoveRow = {
  accuracy: number | null;
  area_length: number;
  area_radius: number;
  area_width: number;
  category: HuntAbilityCategory;
  cooldown_ms: number;
  id: number;
  name: string;
  power: number | null;
  range_tiles: number;
  type_id: number;
};
type CityTypeRow = { id: number; slug: string };
type CityCreatureRows = Array<CityCreatureRow>;
type CityEquippedMoveRows = Array<CityEquippedMoveRow>;
type CityLearnsetRows = Array<CityLearnsetRow>;
type CityMoveRows = Array<CityMoveRow>;
type CityTypeRows = Array<CityTypeRow>;
type CityEquippedAbility = {
  accuracy: number | null;
  areaRadius: number;
  category: HuntAbilityCategory;
  cooldownEndsAt: number;
  cooldownMs: number;
  element: string;
  id: number;
  name: string;
  power: number | null;
  range: number;
  requiredLevel: number;
  slot: number;
};
type CityAvailableAbility = Omit<CityEquippedAbility, 'cooldownEndsAt' | 'slot'>;
export type CityPartyConfiguration = {
  activeCreatureAbilities: Array<CityEquippedAbility>;
  activeCreatureAvailableAbilities: Array<CityAvailableAbility>;
  activeCreatureLevel: number;
};
export type CityBattleConfiguration = CityPartyConfiguration & {
  captureConfiguration: { itemId: number; rarities: Array<string> } | undefined;
  captureItems: Array<CaptureItemResource>;
  healingConfiguration: { itemId: number; thresholdPercentage: number } | undefined;
  healingItemCooldownEndsAt: number;
  healingItems: Array<HealingItemResource>;
};
export type CityBattleConfigurations = {
  configuration: CityBattleConfiguration | undefined;
  partyConfigurations: Record<string, CityPartyConfiguration>;
};

function cityAbility(move: CityMoveRow, requiredLevel: number): CityAvailableAbility {
  return {
    accuracy: move.accuracy,
    areaRadius: Math.max(move.area_radius, move.area_length, move.area_width),
    category: move.category,
    cooldownMs: move.cooldown_ms,
    element: 'normal',
    id: move.id,
    name: move.name,
    power: move.power,
    range: move.range_tiles,
    requiredLevel,
  };
}

export async function loadCityBattleConfigurations(
  client: SupabaseClient,
  characterId: string,
  activeCreatureId: string | null,
): Promise<CityBattleConfigurations> {
  const initialQueries = [
    client
      .from('creatures')
      .select('id, species_id, level')
      .eq('character_id', characterId)
      .not('party_slot', 'is', null)
      .order('party_slot'),
    loadCharacterHealingResources(client, characterId),
    loadCharacterCaptureResources(client, characterId),
  ];
  const [partyResult, healingResources, captureResources] = await Promise.all(initialQueries);
  if (partyResult.error) {
    throw partyResult.error;
  }
  const party = partyResult.data as CityCreatureRows;
  const creatureIds = party.map(function creatureId(creature): string {
    return creature.id;
  });
  const speciesIds = uniqueNumbers(
    party.map(function speciesId(creature): number {
      return creature.species_id;
    }),
  );
  if (creatureIds.length === 0 || speciesIds.length === 0) {
    return { configuration: undefined, partyConfigurations: {} };
  }
  const moveQueries = [
    client
      .from('creature_equipped_moves')
      .select('creature_id, move_id, slot')
      .in('creature_id', creatureIds)
      .order('slot'),
    client
      .from('species_move_learnsets')
      .select('species_id, move_id, required_level')
      .eq('learn_method', 'level')
      .in('species_id', speciesIds),
  ];
  const [equippedResult, learnsetResult] = await Promise.all(moveQueries);
  if (equippedResult.error || learnsetResult.error) {
    throw equippedResult.error ?? learnsetResult.error;
  }
  const equipped = equippedResult.data as CityEquippedMoveRows;
  const learnsets = learnsetResult.data as CityLearnsetRows;
  const moveIds = uniqueNumbers(
    [...equipped, ...learnsets].map(function moveId(move): number {
      return move.move_id;
    }),
  );
  if (moveIds.length === 0) {
    return emptyConfigurations(party, activeCreatureId, healingResources, captureResources);
  }
  const movesResult = await client
    .from('moves')
    .select(
      'id, name, category, type_id, power, accuracy, cooldown_ms, range_tiles, area_radius, area_length, area_width',
    )
    .in('id', moveIds);
  if (movesResult.error) {
    throw movesResult.error;
  }
  const moves = movesResult.data as CityMoveRows;
  const typeIds = uniqueNumbers(
    moves.map(function typeId(move): number {
      return move.type_id;
    }),
  );
  const typesResult = await client.from('types').select('id, slug').in('id', typeIds);
  if (typesResult.error) {
    throw typesResult.error;
  }
  const types = typesResult.data as CityTypeRows;
  return buildConfigurations(
    party,
    activeCreatureId,
    equipped,
    learnsets,
    moves,
    types,
    healingResources,
    captureResources,
  );
}

function emptyConfigurations(
  party: CityCreatureRows,
  activeCreatureId: string | null,
  healingResources: CharacterHealingResources,
  captureResources: CharacterCaptureResources,
): CityBattleConfigurations {
  const configurations: Record<string, CityPartyConfiguration> = {};
  for (const creature of party) {
    configurations[creature.id] = {
      activeCreatureAbilities: [],
      activeCreatureAvailableAbilities: [],
      activeCreatureLevel: creature.level,
    };
  }
  return withGlobalConfiguration(
    configurations,
    activeCreatureId,
    healingResources,
    captureResources,
  );
}

function buildConfigurations(
  party: CityCreatureRows,
  activeCreatureId: string | null,
  equipped: CityEquippedMoveRows,
  learnsets: CityLearnsetRows,
  moves: CityMoveRows,
  types: CityTypeRows,
  healingResources: CharacterHealingResources,
  captureResources: CharacterCaptureResources,
): CityBattleConfigurations {
  const movesById = new Map<number, CityMoveRow>();
  for (const move of moves) {
    movesById.set(move.id, move);
  }
  const elementsByTypeId = new Map<number, string>();
  for (const type of types) {
    elementsByTypeId.set(type.id, type.slug);
  }
  const configurations: Record<string, CityPartyConfiguration> = {};
  for (const creature of party) {
    const available = learnsets.filter(function forSpecies(learnset): boolean {
      return learnset.species_id === creature.species_id;
    });
    const availableByMoveId = new Map<number, number>();
    const availableAbilities: Array<CityAvailableAbility> = [];
    for (const learnset of available) {
      availableByMoveId.set(learnset.move_id, learnset.required_level);
      const move = movesById.get(learnset.move_id);
      if (move) {
        const ability = cityAbility(move, learnset.required_level);
        ability.element = elementsByTypeId.get(move.type_id) ?? 'normal';
        availableAbilities.push(ability);
      }
    }
    const equippedAbilities: Array<CityEquippedAbility> = [];
    for (const assignment of equipped) {
      if (assignment.creature_id !== creature.id) {
        continue;
      }
      const requiredLevel = availableByMoveId.get(assignment.move_id);
      const move = movesById.get(assignment.move_id);
      if (requiredLevel === undefined || !move) {
        continue;
      }
      const ability = cityAbility(move, requiredLevel);
      ability.element = elementsByTypeId.get(move.type_id) ?? 'normal';
      equippedAbilities.push({ ...ability, cooldownEndsAt: 0, slot: assignment.slot });
    }
    configurations[creature.id] = {
      activeCreatureAbilities: equippedAbilities,
      activeCreatureAvailableAbilities: availableAbilities,
      activeCreatureLevel: creature.level,
    };
  }
  return withGlobalConfiguration(
    configurations,
    activeCreatureId,
    healingResources,
    captureResources,
  );
}

function withGlobalConfiguration(
  partyConfigurations: Record<string, CityPartyConfiguration>,
  activeCreatureId: string | null,
  healingResources: CharacterHealingResources,
  captureResources: CharacterCaptureResources,
): CityBattleConfigurations {
  const active = activeCreatureId ? partyConfigurations[activeCreatureId] : undefined;
  const configuration = active
    ? {
        ...active,
        captureConfiguration: captureResources.captureConfiguration,
        captureItems: captureResources.captureItems,
        healingConfiguration: healingResources.healingConfiguration,
        healingItemCooldownEndsAt: 0,
        healingItems: healingResources.healingItems,
      }
    : undefined;
  return { configuration, partyConfigurations };
}
