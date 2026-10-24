import { expect, test } from 'bun:test';

import {
  ABILITY_A,
  BRASA,
  START,
  buildContent,
  buildState,
  buildWild,
} from '~/__tests__/hunt/sim/fixtures';
import { addWild, readCasts } from '~/__tests__/hunt/sim/helpers';
import { advanceUntil } from '~/hunt/sim/simulate';
import type { SimSpecies } from '~/hunt/sim/types';

const CASTER_SPECIES: SimSpecies = {
  ...BRASA,
  abilities: [
    {
      ability: { ...ABILITY_A, name: 'Short', range: 1, slug: 'wild-short' },
      wildChance: 100,
      wildIntervalMs: 2000,
    },
    {
      ability: { ...ABILITY_A, element: 'fire', name: 'Fire', range: 5, slug: 'wild-fire' },
      wildChance: 100,
      wildIntervalMs: 3000,
    },
    {
      ability: { ...ABILITY_A, name: 'Miss', range: 5, slug: 'wild-miss' },
      wildChance: 0,
      wildIntervalMs: 4000,
    },
  ],
  drops: [],
  name: 'Caster',
  slug: 'caster',
};

/**
 * The wild rolls the abilities in the order of the species. The short one is
 * out of reach and is skipped without a draw; the other two are in reach and
 * each one draws, even the one whose chance is zero. So the stream advances
 * exactly twice, and only the ability with a positive chance is cast.
 */
function theWildAbilityRollsInTheSpeciesOrder(): void {
  const content = buildContent({ spawns: [], species: { brasa: BRASA, caster: CASTER_SPECIES } });
  const state = buildState({ content });
  const wild = buildWild(content, { x: 8, y: 5 }, 'caster', 'wild-caster');
  wild.nextDecisionAt = START;
  addWild(state, wild);
  const result = advanceUntil(state, START + 1, content);
  const casts = readCasts(result.events, 'wild-caster');
  expect(casts.length).toBe(1);
  expect(casts[0]?.abilitySlug).toBe('wild-fire');
  expect(state.rng.draws).toBe(2);
  expect(wild.wildReadyAt['wild-fire']).toBe(START + 3000);
  expect(wild.wildReadyAt['wild-miss']).toBeUndefined();
  expect(wild.wildReadyAt['wild-short']).toBeUndefined();
}

test('the wild ability rolls in the species order', theWildAbilityRollsInTheSpeciesOrder);
