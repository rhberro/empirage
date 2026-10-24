/* eslint-disable max-lines -- the collision scenarios share the fixtures and the helpers */
import { expect, test } from 'bun:test';

import type { PathSegment, Tile } from '@creatures/contracts/world';

import {
  START,
  buildContent,
  buildState,
  buildTeamMember,
  buildWild,
} from '~/__tests__/hunt/sim/fixtures';
import {
  addWild,
  expectActorsApart,
  readActive,
  readTeamMember,
} from '~/__tests__/hunt/sim/helpers';
import { CORPSE_LINGER_MS, resolveCaptures, respawnWilds } from '~/hunt/sim/deaths';
import { chebyshev, directionBetween } from '~/hunt/sim/geometry';
import { advanceTrainer, startStep, stepToward } from '~/hunt/sim/movement';
import { isTileBlocked, findFreeTileNear, TRAINER_ACTOR_ID } from '~/hunt/sim/occupancy';
import { advanceUntil, swapActive } from '~/hunt/sim/simulate';
import type { SimEvent, SimState } from '~/hunt/sim/types';
import { sameTile } from '~/hunt/sim/types';

function theTrainerStartsThreeNodesBehindTheSpawn(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const loop = content.map.loop;
  const spawnIndex = loop.findIndex(function isSpawn(node: Tile): boolean {
    return sameTile(node, content.map.spawn);
  });
  const expected = loop[(spawnIndex - 3 + loop.length) % loop.length] as Tile;
  expect(state.trainer.tile).toEqual(expected);
  expect(state.trainer.tile).not.toEqual(content.map.spawn);
  expect(state.trainer.trail).toEqual([expected]);
  expect(state.trainer.dir).toBe(directionBetween(expected, content.map.spawn));
  expect(readActive(state).tile).toEqual(content.map.spawn);
}

function aWildSpawnOverAnActorIsInvalidContent(): void {
  const overTrainer = buildContent({
    spawns: [{ level: 1, respawnMs: 5000, species: 'brasa', x: 5, y: 8 }],
  });
  expect(function buildOverTrainer(): SimState {
    return buildState({ content: overTrainer });
  }).toThrow(/overlaps an actor/u);

  const overPlayer = buildContent({
    spawns: [{ level: 1, respawnMs: 5000, species: 'brasa', x: 5, y: 5 }],
  });
  expect(function buildOverPlayer(): SimState {
    return buildState({ content: overPlayer });
  }).toThrow(/overlaps an actor/u);
}

function theOccupancyReadsConfirmedAndPendingTiles(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [
      buildTeamMember({ creatureId: 'creature-1' }),
      buildTeamMember({ creatureId: 'creature-2' }),
    ],
  });
  const active = readActive(state);
  const wild = buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-a');
  addWild(state, wild);
  const bench = readTeamMember(state, 'creature-2');
  bench.tile = { x: 15, y: 15 };

  expect(isTileBlocked(state, active.tile, wild.id)).toBe(true);
  expect(isTileBlocked(state, active.tile, active.id)).toBe(false);
  expect(isTileBlocked(state, wild.tile, active.id)).toBe(true);
  expect(isTileBlocked(state, state.trainer.tile, active.id)).toBe(false);
  expect(isTileBlocked(state, bench.tile, active.id)).toBe(false);

  wild.segment = buildSegment(wild.tile, { x: 8, y: 5 });
  expect(isTileBlocked(state, { x: 8, y: 5 }, active.id)).toBe(true);
  expect(isTileBlocked(state, { x: 8, y: 5 }, wild.id)).toBe(false);
  expect(isTileBlocked(state, wild.tile, TRAINER_ACTOR_ID)).toBe(true);
}

function theWalkRoutesAroundABlockedTile(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const active = readActive(state);
  const wild = buildWild(content, { x: 6, y: 5 }, 'broto', 'wild-blocker');
  addWild(state, wild);
  const isBlocked = buildActiveBlockedCheck(state, active.id);

  expect(startStep(active, { x: 6, y: 5 }, START, content.map, isBlocked)).toBe(false);
  expect(active.segment).toBeUndefined();
  expect(stepToward(active, { x: 8, y: 5 }, START, content.map, isBlocked)).toBe(true);
  const detour = active.segment?.to;
  expect(detour).toBeDefined();
  if (detour === undefined) {
    return;
  }
  expect(isBlocked(detour)).toBe(false);
  expect(detour).not.toEqual({ x: 6, y: 5 });
  active.segment = undefined;
  expect(startStep(active, { x: 6, y: 5 }, START, content.map)).toBe(true);
  expect(
    startStep(wild, active.tile, START, content.map, buildActiveBlockedCheck(state, wild.id)),
  ).toBe(false);
  expect(wild.segment).toBeUndefined();
}

function theTrainerDoesNotEnterTheActiveTile(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const active = readActive(state);
  state.trainer.tile = { x: 4, y: 5 };
  state.trainer.trail = [
    { x: 5, y: 5 },
    { x: 5, y: 4 },
    { x: 5, y: 3 },
  ];
  const isBlocked = buildActiveBlockedCheck(state, TRAINER_ACTOR_ID);

  advanceTrainer(state.trainer, active.tile, START, content.map, isBlocked);

  expect(state.trainer.tile).toEqual({ x: 4, y: 5 });
  expect(state.trainer.segment).toBeUndefined();
}

function theActorsNeverShareATile(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  addWild(state, buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-a'));
  addWild(state, buildWild(content, { x: 10, y: 9 }, 'brasa', 'wild-b'));

  for (let now = START; now <= START + 4000; now += 50) {
    advanceUntil(state, now, content);
    expectActorsApart(state);
  }
}

function theActiveStopsBeforeTheWildTile(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  addWild(state, buildWild(content, { x: 7, y: 5 }, 'broto', 'wild-bait'));

  advanceUntil(state, START + 2000, content);

  const active = readActive(state);
  const wild = state.wilds[0];
  if (wild === undefined) {
    throw new Error('the fixture lost the wild');
  }
  expect(sameTile(active.tile, { x: 7, y: 5 })).toBe(false);
  expect(sameTile(active.tile, wild.tile)).toBe(false);
  expect(chebyshev(active.tile, wild.tile)).toBe(1);
}

function theActiveLooksAtTheTargetAfterAStep(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  addWild(state, buildWild(content, { x: 8, y: 9 }, 'broto', 'wild-look'));
  const active = readActive(state);

  advanceUntil(state, START + 1, content);
  expect(active.targetId).toBe('wild-look');
  expect(active.dir).toBe('downRight');

  advanceUntil(state, START + 301, content);
  expect(active.dir).toBe(directionBetween(active.tile, { x: 8, y: 9 }));
  expect(active.dir).toBe('downRight');
  expect(active.segment).not.toBeUndefined();
}

function theWildLooksAtTheTargetAfterAStep(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const wild = buildWild(content, { x: 10, y: 8 }, 'broto', 'wild-look');
  wild.nextDecisionAt = START;
  addWild(state, wild);

  advanceUntil(state, START + 1, content);

  const active = readActive(state);
  expect(wild.targetId).toBe(active.id);
  expect(wild.dir).toBe('upLeft');
  expect(wild.dir).toBe(directionBetween(wild.tile, active.tile));
}

function theRespawnWaitsForEveryActor(): void {
  const content = buildContent({
    spawns: [{ level: 1, respawnMs: 5000, species: 'brasa', x: 8, y: 7 }],
  });
  const state = buildState({ content });
  const wild = state.wilds[0];
  if (wild === undefined) {
    throw new Error('the fixture has no wild');
  }
  wild.hp = 0;
  advanceUntil(state, START + 1, content);
  const captureAt = START + CORPSE_LINGER_MS;
  const events: SimEvent[] = [];
  resolveCaptures(state, content, captureAt, events);
  expect(state.wilds.length).toBe(0);
  expect(state.spawns[0]?.respawnAt).toBe(captureAt + 5000);

  state.trainer.tile = { x: 8, y: 7 };
  state.trainer.segment = undefined;
  respawnWilds(state, content, captureAt + 5000, events);
  expect(state.wilds.length).toBe(0);
  expect(state.spawns[0]?.respawnAt).toBe(captureAt + 6000);

  state.trainer.tile = { x: 1, y: 1 };
  const blocker = buildWild(content, { x: 8, y: 6 }, 'broto', 'wild-blocker');
  blocker.segment = buildSegment({ x: 8, y: 6 }, { x: 8, y: 7 });
  addWild(state, blocker);
  respawnWilds(state, content, captureAt + 6000, events);
  expect(state.wilds.length).toBe(1);
  expect(state.spawns[0]?.respawnAt).toBe(captureAt + 7000);

  blocker.segment = undefined;
  blocker.tile = { x: 1, y: 1 };
  respawnWilds(state, content, captureAt + 7000, events);
  expect(state.wilds.length).toBe(2);
  expect(state.spawns[0]?.respawnAt).toBeNull();
}

function theManualSwapNeverStacksActors(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [
      buildTeamMember({ creatureId: 'creature-1' }),
      buildTeamMember({ creatureId: 'creature-2' }),
    ],
  });
  state.trainer.tile = { x: 5, y: 5 };
  state.trainer.segment = undefined;

  expect(swapActive(state, 'creature-2', START + 100, content.map)).toBe(true);

  const active = readActive(state);
  expect(sameTile(active.tile, state.trainer.tile)).toBe(false);
  expect(active.tile).not.toEqual({ x: 5, y: 5 });
}

function theAutomaticSwapNeverStacksActors(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [
      buildTeamMember({ creatureId: 'creature-1' }),
      buildTeamMember({ creatureId: 'creature-2' }),
    ],
  });
  const deadTile = { x: readActive(state).tile.x, y: readActive(state).tile.y };
  state.trainer.tile = { x: deadTile.x, y: deadTile.y };
  state.trainer.segment = undefined;
  readTeamMember(state, 'creature-1').hp = 0;

  advanceUntil(state, START + 1, content);

  expect(state.activeCreatureId).toBe('creature-2');
  const active = readActive(state);
  expect(sameTile(active.tile, state.trainer.tile)).toBe(false);
  expect(sameTile(active.tile, deadTile)).toBe(false);
}

function theFreeTilePrefersTheClosestStep(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const target = readActive(state).tile;
  const left = buildWild(content, { x: target.x - 1, y: target.y }, 'broto', 'wild-left');
  const down = buildWild(content, { x: target.x, y: target.y + 1 }, 'broto', 'wild-down');
  const mover = buildWild(content, { x: target.x - 1, y: target.y + 2 }, 'broto', 'wild-mover');
  addWild(state, left);
  addWild(state, down);
  addWild(state, mover);

  const slot = findFreeTileNear(state, target, mover.id, undefined, mover.tile);
  expect(slot).toEqual({ x: target.x - 1, y: target.y + 1 });
}

function buildSegment(from: Tile, to: Tile): PathSegment {
  return {
    dir: directionBetween(from, to),
    endsAt: START + 300,
    from: { x: from.x, y: from.y },
    startsAt: START,
    to: { x: to.x, y: to.y },
  };
}

function buildActiveBlockedCheck(state: SimState, moverId: string): (tile: Tile) => boolean {
  function isBlocked(tile: Tile): boolean {
    return isTileBlocked(state, tile, moverId);
  }
  return isBlocked;
}

test(
  'the trainer starts three loop nodes behind the spawn',
  theTrainerStartsThreeNodesBehindTheSpawn,
);
test('a wild spawn over an actor is invalid content', aWildSpawnOverAnActorIsInvalidContent);
test('the occupancy reads confirmed and pending tiles', theOccupancyReadsConfirmedAndPendingTiles);
test('the walk routes around a blocked tile', theWalkRoutesAroundABlockedTile);
test('the trainer does not enter the active tile', theTrainerDoesNotEnterTheActiveTile);
test('the actors never share a tile', theActorsNeverShareATile);
test('the active stops before the wild tile', theActiveStopsBeforeTheWildTile);
test('the active looks at the target after a step', theActiveLooksAtTheTargetAfterAStep);
test('the wild looks at the target after a step', theWildLooksAtTheTargetAfterAStep);
test('the respawn waits for every actor', theRespawnWaitsForEveryActor);
test('the manual swap never stacks actors', theManualSwapNeverStacksActors);
test('the automatic swap never stacks actors', theAutomaticSwapNeverStacksActors);
test('the free tile prefers the closest step', theFreeTilePrefersTheClosestStep);
