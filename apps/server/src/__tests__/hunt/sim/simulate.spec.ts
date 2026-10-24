import { expect, test } from 'bun:test';

import {
  ABILITY_A,
  ABILITY_B,
  ABILITY_C,
  ABILITY_D,
  START,
  buildContent,
  buildState,
  buildTeamMember,
  buildWild,
} from '~/__tests__/hunt/sim/fixtures';
import {
  addWild,
  containsTile,
  hugeWild,
  readActive,
  readCasts,
  readTeamMember,
} from '~/__tests__/hunt/sim/helpers';
import type { AbilityCastEvent } from '~/__tests__/hunt/sim/helpers';
import { chebyshev } from '~/hunt/sim/geometry';
import { advanceUntil, swapActive } from '~/hunt/sim/simulate';
import type { SimEvent } from '~/hunt/sim/types';

function twoStatesAreDeterministic(): void {
  const content = buildContent();
  const first = buildState({ content });
  const second = buildState({ content });
  const firstResult = advanceUntil(first, START + 30_000, content);
  const secondResult = advanceUntil(second, START + 30_000, content);
  expect(JSON.stringify(firstResult.state)).toBe(JSON.stringify(secondResult.state));
  expect(firstResult.events).toEqual(secondResult.events);
}

function theCreatureWalksTheLoopAndTheTrainerFollows(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  advanceUntil(state, START + 10_000, content);
  const active = readActive(state);
  expect(containsTile(content.map.loop, active.tile)).toBe(true);
  expect(active.tile).not.toEqual(content.map.spawn);
  const distance = chebyshev(active.tile, state.trainer.tile);
  expect(distance).toBeGreaterThanOrEqual(2);
  expect(distance).toBeLessThanOrEqual(5);
  expect(state.trainer.trail.length).toBeGreaterThan(1);
}

function theWildInsideSixIsTargeted(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  addWild(state, buildWild(content, { x: 11, y: 5 }, 'broto', 'wild-target'));
  advanceUntil(state, START + 50, content);
  const active = readActive(state);
  expect(active.targetId).toBe('wild-target');
  expect(active.behavior).toBe('chase');
  expect(state.ledger.encounters).toBe(1);
}

function theWildAtEightIsNotTargeted(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  addWild(state, buildWild(content, { x: 13, y: 5 }, 'broto', 'wild-far'));
  advanceUntil(state, START + 50, content);
  expect(readActive(state).targetId).toBeNull();
  expect(state.ledger.encounters).toBe(0);
}

function theTargetIsLostBeyondNine(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const wild = buildWild(content, { x: 11, y: 5 }, 'broto', 'wild-target');
  addWild(state, wild);
  advanceUntil(state, START + 50, content);
  expect(readActive(state).targetId).toBe('wild-target');
  wild.tile = { x: 16, y: 15 };
  const result = advanceUntil(state, START + 400, content);
  expect(readActive(state).targetId).toBeNull();
  expect(readActive(state).behavior).toBe('loop');
  const lost = result.events.filter(function isTargetChange(event: SimEvent): boolean {
    return event.type === 'target_changed' && event.targetId === null;
  });
  expect(lost.length).toBe(1);
}

function theRotationFollowsTheSkillBar(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ abilities: [ABILITY_A, ABILITY_B, ABILITY_C, ABILITY_D] })],
  });
  hugeWild(state, buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-dummy'));
  const result = advanceUntil(state, START + 5999, content);
  const casts = readCasts(result.events, 'creature-1');
  const order = casts.map(function readSlug(event: AbilityCastEvent): string {
    return event.abilitySlug;
  });
  expect(order).toEqual(['a', 'b', 'c', 'd', 'b', 'a']);
  for (let index = 1; index < casts.length; index += 1) {
    const previous = casts[index - 1];
    const current = casts[index];
    expect(current?.at ?? 0).toBe((previous?.at ?? 0) + 1000);
  }
}

function theCooldownTravelsWithTheCreature(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [
      buildTeamMember({ abilities: [ABILITY_A, null, null, null], creatureId: 'creature-1' }),
      buildTeamMember({ abilities: [ABILITY_A, null, null, null], creatureId: 'creature-2' }),
    ],
  });
  hugeWild(state, buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-dummy'));
  advanceUntil(state, START + 1, content);
  const first = readTeamMember(state, 'creature-1');
  const second = readTeamMember(state, 'creature-2');
  expect(first.abilityReadyAt[0]).toBe(START + 4000);
  expect(second.abilityReadyAt[0]).toBe(START);
  expect(swapActive(state, 'creature-2', START + 100)).toBe(true);
  expect(state.activeCreatureId).toBe('creature-2');
  expect(first.abilityReadyAt[0]).toBe(START + 4000);
  advanceUntil(state, START + 2000, content);
  expect(first.abilityReadyAt[0]).toBe(START + 4000);
}

test('the same state and the same seed are deterministic', twoStatesAreDeterministic);
test(
  'the creature walks the loop and the trainer follows',
  theCreatureWalksTheLoopAndTheTrainerFollows,
);
test('a wild inside six squares is targeted', theWildInsideSixIsTargeted);
test('a wild at eight squares is not targeted', theWildAtEightIsNotTargeted);
test('the target is lost beyond nine squares', theTargetIsLostBeyondNine);
test('the rotation follows the skill bar', theRotationFollowsTheSkillBar);
test('the cooldown travels with the creature', theCooldownTravelsWithTheCreature);
