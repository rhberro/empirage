import type { HuntMap } from '@creatures/contracts/huntMap';
import { huntMapBySlug } from '@creatures/contracts/huntMap';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  readAreaSpeciesIds,
  readDropRows,
  readEffectivenessRows,
  readEquippedAbilityRows,
  readGearSlotRows,
  readHuntArea,
  readSpeciesAbilityRows,
  readSpeciesByIds,
  readSpeciesBySlugs,
  readTeamRows,
  readTrainerLoad,
} from '~/db/huntContentRepository';
import type {
  HuntAreaRow,
  HuntCreatureRow,
  HuntDropRow,
  HuntEffectivenessRow,
  HuntEquippedAbilityRow,
  HuntGearSlotRow,
  HuntSpeciesAbilityRow,
  HuntSpeciesRow,
  HuntTrainerRow,
} from '~/db/huntContentRepository';
import { readItemQuantities } from '~/db/loadoutRepository';
import { HuntStartError } from '~/hunt/errors';

import type { HuntAreaContent } from './contentMappers';
import { mapHuntAreaContent } from './contentMappers';
import type { HuntTeamLoad } from './teamMappers';
import { mapHuntTeam } from './teamMappers';

/**
 * The level and the stamina of the trainer that owns the hunt.
 */
export type HuntTrainerLoad = {
  level: number;
  staminaMinutes: number;
};

export {
  mapAbility,
  mapAbility as mapAbilityRow,
  mapDropRow,
  mapEffectivenessRow,
  mapHuntAreaContent,
  mapSpeciesAbility,
  mapSpeciesRow,
} from './contentMappers';
export type { HuntAreaContent } from './contentMappers';
export { mapHuntTeam, mapTeamMember } from './teamMappers';
export type { HuntTeamLoad } from './teamMappers';

/**
 * The content of one area, with the team species included.
 *
 * The area declares the species that spawn there, but a trainer can bring any
 * creature of the catalog: the extra slugs keep the simulation able to read the
 * base values of the team.
 */
export function loadHuntAreaContent(
  admin: SupabaseClient,
  areaId: string,
  extraSpeciesSlugs?: string[],
): Promise<HuntAreaContent> {
  return readHuntArea(admin, areaId).then(function withArea(
    area: HuntAreaRow | null,
  ): Promise<HuntAreaContent> {
    if (area === null) {
      throw new HuntStartError('area_not_found');
    }
    const map = huntMapBySlug(area.slug);
    if (map === null) {
      throw new HuntStartError('area_not_found', `The area ${area.slug} has no committed map`);
    }
    return readAreaContent(admin, area, map, extraSpeciesSlugs ?? []);
  });
}

/**
 * The team of a trainer, in the order of the team slots.
 */
export function loadHuntTeam(admin: SupabaseClient, trainerId: string): Promise<HuntTeamLoad> {
  return Promise.all([readTeamRows(admin, trainerId), readTrainerLoad(admin, trainerId)]).then(
    function withTeam(reads: [HuntCreatureRow[], HuntTrainerRow | null]): Promise<HuntTeamLoad> {
      const [rows, trainer] = reads;
      return readTeamContent(admin, trainerId, rows, trainer);
    },
  );
}

/**
 * The level and the stamina of a trainer.
 */
export function loadHuntTrainer(
  admin: SupabaseClient,
  trainerId: string,
): Promise<HuntTrainerLoad | null> {
  return readTrainerLoad(admin, trainerId).then(function toLoad(
    row: HuntTrainerRow | null,
  ): HuntTrainerLoad | null {
    if (row === null) {
      return null;
    }
    return { level: row.level, staminaMinutes: row.stamina_minutes };
  });
}

function readAreaContent(
  admin: SupabaseClient,
  area: HuntAreaRow,
  map: HuntMap,
  extraSpeciesSlugs: string[],
): Promise<HuntAreaContent> {
  return readAreaSpeciesIds(admin, area.id).then(function withSpeciesIds(
    areaSpeciesIds: string[],
  ): Promise<HuntAreaContent> {
    return Promise.all([
      readSpeciesByIds(admin, areaSpeciesIds),
      readSpeciesBySlugs(admin, extraSpeciesSlugs),
    ]).then(function withSpecies(
      reads: [HuntSpeciesRow[], HuntSpeciesRow[]],
    ): Promise<HuntAreaContent> {
      const speciesRows = mergeSpeciesRows(reads[0], reads[1]);
      const speciesIds = speciesRows.map(readSpeciesId);
      return Promise.all([
        readSpeciesAbilityRows(admin, speciesIds),
        readDropRows(admin, speciesIds),
        readEffectivenessRows(admin),
      ]).then(function build(
        content: [HuntSpeciesAbilityRow[], HuntDropRow[], HuntEffectivenessRow[]],
      ): HuntAreaContent {
        const [abilityRows, dropRows, effectivenessRows] = content;
        return mapHuntAreaContent({
          abilityRows,
          area,
          dropRows,
          effectivenessRows,
          map,
          speciesRows,
        });
      });
    });
  });
}

function readTeamContent(
  admin: SupabaseClient,
  trainerId: string,
  rows: HuntCreatureRow[],
  trainer: HuntTrainerRow | null,
): Promise<HuntTeamLoad> {
  return Promise.all([
    readEquippedAbilityRows(admin, rows.map(readCreatureId)),
    readGearSlotRows(admin, trainerId),
    readItemQuantities(admin, trainerId),
  ]).then(function build(
    content: [HuntEquippedAbilityRow[], HuntGearSlotRow[], Map<string, number>],
  ): HuntTeamLoad {
    const [abilityRows, gearRows, quantities] = content;
    return mapHuntTeam({
      abilityRows,
      gearRows,
      quantities,
      staminaMinutes: trainer?.stamina_minutes ?? 0,
      teamRows: rows,
    });
  });
}

function mergeSpeciesRows(
  areaSpecies: HuntSpeciesRow[],
  extraSpecies: HuntSpeciesRow[],
): HuntSpeciesRow[] {
  const bySlug = new Map<string, (typeof areaSpecies)[number]>();
  for (const row of areaSpecies) {
    bySlug.set(row.slug, row);
  }
  for (const row of extraSpecies) {
    bySlug.set(row.slug, row);
  }
  return [...bySlug.values()];
}

function readCreatureId(row: HuntCreatureRow): string {
  return row.id;
}

function readSpeciesId(row: { id: string }): string {
  return row.id;
}
