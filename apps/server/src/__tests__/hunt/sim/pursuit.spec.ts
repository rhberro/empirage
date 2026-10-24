import { expect, test } from 'bun:test';

import type { Tile } from '@creatures/contracts/world';

import {
  ABILITY_A,
  START,
  buildContent,
  buildState,
  buildTeamMember,
  buildWild,
} from '~/__tests__/hunt/sim/fixtures';
import { addWild, hugeWild, readActive } from '~/__tests__/hunt/sim/helpers';
import { chebyshev } from '~/hunt/sim/geometry';
import { advanceUntil } from '~/hunt/sim/simulate';
import { sameTile } from '~/hunt/sim/types';

const HOLD_ABILITY = {
  ...ABILITY_A,
  cooldownMs: 1_000_000,
  damage: 1,
  name: 'Hold',
  range: 7,
  slug: 'hold',
};

function theActiveAndTheWildApproachTogether(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const wild = buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-runner');
  wild.nextDecisionAt = START;
  addWild(state, wild);

  advanceUntil(state, START + 1, content);

  expect(readActive(state).segment).not.toBeUndefined();
  expect(wild.segment).not.toBeUndefined();

  advanceUntil(state, START + 301, content);

  expect(readActive(state).tile).not.toEqual({ x: 5, y: 5 });
  expect(wild.tile).not.toEqual({ x: 9, y: 5 });
}

function theWildDetoursAroundTheActorInThePath(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ abilities: [HOLD_ABILITY] })],
  });
  const blocker = buildWild(content, { x: 7, y: 5 }, 'broto', 'wild-blocker');
  hugeWild(state, blocker);
  const chaser = buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-chaser');
  chaser.nextDecisionAt = START;
  addWild(state, chaser);

  advanceUntil(state, START + 12_000, content);

  const active = readActive(state);
  expect(active.tile).toEqual({ x: 5, y: 5 });
  expect(chebyshev(chaser.tile, active.tile)).toBe(1);
  expect(sameTile(chaser.tile, blocker.tile)).toBe(false);
}

function theSurroundedTargetStopsTheChaseOnTheFreeRing(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const ring = [
    { x: 4, y: 4 },
    { x: 5, y: 4 },
    { x: 6, y: 4 },
    { x: 4, y: 5 },
    { x: 6, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
  ];
  for (let index = 0; index < ring.length; index += 1) {
    const tile = ring[index] as Tile;
    addWild(state, buildWild(content, tile, 'broto', `wild-ring-${index}`));
  }
  const chaser = buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-chaser');
  chaser.nextDecisionAt = START;
  addWild(state, chaser);

  advanceUntil(state, START + 15_000, content);

  const active = readActive(state);
  expect(sameTile(chaser.tile, active.tile)).toBe(false);
  expect(chebyshev(chaser.tile, active.tile)).toBe(2);
  for (const wild of state.wilds) {
    if (wild.id !== chaser.id) {
      expect(sameTile(chaser.tile, wild.tile)).toBe(false);
    }
  }
}

test('the active and the wild approach together', theActiveAndTheWildApproachTogether);
test('the wild detours around the actor in the path', theWildDetoursAroundTheActorInThePath);
test(
  'the surrounded target stops the chase on the free ring',
  theSurroundedTargetStopsTheChaseOnTheFreeRing,
);
