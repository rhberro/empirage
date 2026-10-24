import { expect, test } from 'bun:test';

import {
  ABILITY_A,
  BRASA,
  LINE_ABILITY,
  START,
  buildContent,
  buildState,
  buildTeamMember,
  buildWild,
} from '~/__tests__/hunt/sim/fixtures';
import {
  addWild,
  containsTile,
  readActive,
  readCasts,
  readDamage,
} from '~/__tests__/hunt/sim/helpers';
import { effectiveRange } from '~/hunt/sim/combat';
import { chebyshev, waveTiles } from '~/hunt/sim/geometry';
import { advanceUntil } from '~/hunt/sim/simulate';
import type { SimAbility, SimSpecies } from '~/hunt/sim/types';

const SELF_CIRCLE: SimAbility = {
  areaLength: null,
  areaRadius: 2,
  areaShape: 'circle',
  areaStepMs: 0,
  cooldownMs: 2000,
  damage: 30,
  element: 'neutral',
  name: 'Explosion',
  range: 0,
  slug: 'explosion',
  targetType: 'area_self',
  travelMs: 0,
};

const SELF_SPECIES: SimSpecies = {
  ...BRASA,
  abilities: [{ ability: SELF_CIRCLE, wildChance: 100, wildIntervalMs: 2000 }],
  drops: [],
  name: 'Self Caster',
  slug: 'self-caster',
};

function theEffectiveRangeOfEachType(): void {
  expect(effectiveRange(ABILITY_A)).toBe(5);
  expect(effectiveRange(LINE_ABILITY)).toBe(5);
  expect(effectiveRange(SELF_CIRCLE)).toBe(2);
  expect(effectiveRange({ ...SELF_CIRCLE, areaRadius: 3 })).toBe(3);
  expect(effectiveRange({ ...SELF_CIRCLE, areaRadius: 0 })).toBe(1);
  expect(effectiveRange({ ...SELF_CIRCLE, areaRadius: null })).toBe(1);
}

function theSelfWaveIsCentredOnTheCaster(): void {
  const content = buildContent({ spawns: [] });
  const tiles = waveTiles(SELF_CIRCLE, { x: 5, y: 5 }, { x: 9, y: 9 }, content.map, START);
  expect(containsTile(tiles.map(readTile), { x: 5, y: 5 })).toBe(true);
  expect(containsTile(tiles.map(readTile), { x: 9, y: 9 })).toBe(false);
  for (const entry of tiles) {
    expect(chebyshev(entry.tile, { x: 5, y: 5 })).toBeLessThanOrEqual(2);
    expect(entry.arrivalAt).toBe(START);
  }
}

function thePlayerSelfAreaHitsOnlyTheEnemiesInTheRadius(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ abilities: [SELF_CIRCLE] })],
  });
  addWild(state, buildWild(content, { x: 7, y: 5 }, 'broto', 'wild-inside'));
  addWild(state, buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-outside'));

  const result = advanceUntil(state, START + 1, content);

  const casts = readCasts(result.events, 'creature-1');
  expect(casts.length).toBe(1);
  const cast = casts[0];
  if (cast === undefined) {
    return;
  }
  expect(cast.targetTile).toBeUndefined();
  expect('targetTile' in cast).toBe(false);

  const damage = readDamage(result.events);
  expect(damage.some(readTargetIs('wild-inside'))).toBe(true);
  expect(damage.some(readTargetIs('wild-outside'))).toBe(false);
  expect(damage.some(readTargetIs('creature-1'))).toBe(false);

  const active = readActive(state);
  expect(active.tile).toEqual({ x: 5, y: 5 });
  expect(active.segment).toBeUndefined();
}

function thePlayerDoesNotCastWhenTheTargetIsOutsideTheRadius(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ abilities: [SELF_CIRCLE] })],
  });
  addWild(state, buildWild(content, { x: 8, y: 5 }, 'broto', 'wild-far'));

  const result = advanceUntil(state, START + 1, content);

  expect(readCasts(result.events, 'creature-1').length).toBe(0);
  expect(readActive(state).segment).not.toBeUndefined();
  expect(state.waves.length).toBe(0);
}

function theWildSelfAreaHitsTheActiveCreature(): void {
  const content = buildContent({
    spawns: [],
    species: { brasa: BRASA, 'self-caster': SELF_SPECIES },
  });
  const state = buildState({ content });
  const wild = buildWild(content, { x: 7, y: 5 }, 'self-caster', 'wild-self');
  wild.nextDecisionAt = START;
  addWild(state, wild);

  const result = advanceUntil(state, START + 1, content);

  const casts = readCasts(result.events, 'wild-self');
  expect(casts.length).toBe(1);
  const cast = casts[0];
  if (cast === undefined) {
    return;
  }
  expect(cast.targetTile).toBeUndefined();
  expect('targetTile' in cast).toBe(false);
  expect(readDamage(result.events).some(readTargetIs('creature-1'))).toBe(true);
  expect(wild.tile).toEqual({ x: 7, y: 5 });
}

function readTile(entry: { tile: { x: number; y: number } }): { x: number; y: number } {
  return entry.tile;
}

function readTargetIs(targetId: string): (event: { targetId: string }) => boolean {
  return function targetsTheId(event: { targetId: string }): boolean {
    return event.targetId === targetId;
  };
}

test('the effective range follows the ability type', theEffectiveRangeOfEachType);
test('the self wave is centred on the caster', theSelfWaveIsCentredOnTheCaster);
test(
  'the player self area hits only the enemies in the radius',
  thePlayerSelfAreaHitsOnlyTheEnemiesInTheRadius,
);
test(
  'the player does not cast when the target is outside the radius',
  thePlayerDoesNotCastWhenTheTargetIsOutsideTheRadius,
);
test('the wild self area hits the active creature', theWildSelfAreaHitsTheActiveCreature);
