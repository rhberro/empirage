import type { CityMap, Tile } from '@creatures/contracts/world';
import { isWalkableTile } from '@creatures/contracts/world';

import { thinkPlayer, thinkTrainer, thinkWild } from '~/hunt/sim/ai';
import { resolveProjectiles, resolveWaves } from '~/hunt/sim/combat';
import { consumeConsumables } from '~/hunt/sim/consumables';
import { resolveCaptures, resolveDeaths, respawnWilds } from '~/hunt/sim/deaths';
import { createFlowField } from '~/hunt/sim/flow';
import type { FlowField } from '~/hunt/sim/flow';
import { finishStep } from '~/hunt/sim/movement';
import type { SimMover } from '~/hunt/sim/movement';
import { findFreeTileNear, TRAINER_ACTOR_ID } from '~/hunt/sim/occupancy';
import type { SimContent, SimEvent, SimState, SimTeamMember } from '~/hunt/sim/types';
import { activeCreature, isAlive } from '~/hunt/sim/types';
import { cloneTile, readOrderedWilds } from '~/hunt/sim/world';

export { createHuntState } from '~/hunt/sim/create';
export type { CreateHuntStateInput } from '~/hunt/sim/create';
export { resolveCaptures, resolveDeaths, respawnWilds };
export { TRAINER_ACTOR_ID };

/** The time the server waits between two manual swaps. */
const SWAP_COOLDOWN_MS = 5000;

/**
 * Moves the simulation forward, until the given moment.
 *
 * The function is pure against the outside world: it never reads the wall
 * clock, never calls the random generator of the language and never touches
 * I/O. The time comes by argument and the randomness comes from the state. It
 * mutates and returns the state it received, which is what makes a checkpoint
 * a single serialization of the same object.
 */
export function advanceUntil(
  state: SimState,
  until: number,
  content: SimContent,
): { events: SimEvent[]; state: SimState } {
  const events: SimEvent[] = [];
  if (state.ended || until <= state.simulatedAt) {
    return { events, state };
  }
  let now = state.simulatedAt;
  const flow = createFlowField();
  if (now >= state.endsAt) {
    now = state.endsAt;
    closeAtWindowEnd(state);
  }
  while (!state.ended) {
    if (now >= state.endsAt) {
      now = state.endsAt;
      closeAtWindowEnd(state);
      break;
    }
    processInstant(state, content, now, events, flow);
    if (state.ended) {
      break;
    }
    const next = readNextInstant(state, now, until);
    if (next === null || next > until) {
      break;
    }
    now = next;
  }
  state.simulatedAt = Math.min(now, state.endsAt, until);
  return { events, state };
}

/**
 * The next instant the simulation has a step, a decision, a cooldown, a wave,
 * a respawn or the end of the window.
 *
 * The scheduler wakes the hunt exactly there, so a step is published at the
 * instant it starts instead of waiting for the next periodic tick. The time is
 * absolute and the function does not mutate the state.
 */
export function nextInstant(state: SimState): number | null {
  if (state.ended) {
    return null;
  }
  return readNextInstant(state, state.simulatedAt, state.endsAt);
}

/**
 * Swaps the active creature for another living member of the team.
 *
 * The cooldowns travel with each creature, so the one that leaves keeps its
 * own. The newcomer enters on the tile the old active was on, with no target
 * and with the loop as behavior. If a wild or the trainer is standing there,
 * it takes the first free and walkable neighbor instead.
 */
export function swapActive(
  state: SimState,
  creatureId: string,
  now: number,
  map?: CityMap,
): boolean {
  const current = activeCreature(state);
  if (creatureId === current.id) {
    return true;
  }
  if (now - state.lastSwapAt < SWAP_COOLDOWN_MS) {
    return false;
  }
  const next = readLivingMember(state, creatureId);
  if (next === null) {
    return false;
  }
  // The outgoing creature leaves the field, so its tile is the natural entry
  // point. A blocked tile (a wild or the trainer on it) falls back to a free
  // neighbor; the trail restarts from the chosen tile.
  const tile = findFreeTileNear(
    state,
    current.tile,
    current.id,
    map === undefined
      ? undefined
      : function isWalkable(candidate: Tile): boolean {
          return isWalkableTile(map, candidate);
        },
  );
  next.behavior = 'loop';
  next.dir = current.dir;
  next.loopIndex = state.loopIndex;
  next.nextAbilityAt = Math.max(next.nextAbilityAt, now);
  next.segment = undefined;
  next.targetId = null;
  next.tile = tile;
  next.trail = [cloneTile(tile)];
  state.activeCreatureId = next.id;
  state.lastSwapAt = now;
  state.trainer.trail = [cloneTile(tile)];
  return true;
}

/**
 * Ends the hunt by the choice of the player, at the given instant.
 */
export function finalizeHunt(state: SimState, now: number): void {
  state.ended = true;
  state.endReason = 'player_finalized';
  state.endsAt = now;
}

function processInstant(
  state: SimState,
  content: SimContent,
  now: number,
  events: SimEvent[],
  flow: FlowField,
): void {
  const active = activeCreature(state);
  finishActor(active, active.id, now, events);
  finishActor(state.trainer, TRAINER_ACTOR_ID, now, events);
  for (const wild of readOrderedWilds(state)) {
    finishActor(wild, wild.id, now, events);
  }
  resolveProjectiles(state, content, now, events);
  resolveWaves(state, content, now, events);
  resolveDeaths(state, content, now, events);
  if (state.ended) {
    return;
  }
  resolveCaptures(state, content, now, events);
  respawnWilds(state, content, now, events);
  thinkPlayer(state, content, now, events);
  thinkWild(state, content, now, events, flow);
  // A cast of this instant may already have a tile reached at this same
  // instant (the centre of a circle, for example); resolving the waves again
  // keeps the arrival time exact instead of pushing it to the next instant.
  resolveWaves(state, content, now, events);
  thinkTrainer(state, now, content);
  consumeConsumables(state, content, now, events);
  // A decision of this instant may have killed someone; closing the death here
  // credits the kill, the loot and the experience at the moment it happened.
  resolveDeaths(state, content, now, events);
}

function finishActor(mover: SimMover, actorId: string, now: number, events: SimEvent[]): void {
  const segment = mover.segment;
  if (segment === undefined || segment.endsAt > now) {
    return;
  }
  const from = cloneTile(segment.from);
  const to = cloneTile(segment.to);
  if (finishStep(mover, now)) {
    events.push({ actorId, at: now, from, to, type: 'step' });
  }
}

function readNextInstant(state: SimState, now: number, until: number): number | null {
  let next: number | null = null;
  const active = activeCreature(state);

  function consider(at: number | null | undefined): void {
    if (at === null || at === undefined || at <= now) {
      return;
    }
    if (next === null || at < next) {
      next = at;
    }
  }

  consider(active.segment?.endsAt);
  consider(state.trainer.segment?.endsAt);
  for (const wild of state.wilds) {
    if (isAlive(wild)) {
      consider(wild.segment?.endsAt);
      consider(wild.nextDecisionAt);
      continue;
    }
    consider(wild.captureAt ?? null);
  }
  if (isAlive(active) && active.targetId !== null) {
    consider(active.nextAbilityAt);
    for (const readyAt of active.abilityReadyAt) {
      consider(readyAt);
    }
  }
  if (isAlive(active)) {
    for (const readyAt of active.consumableReadyAt) {
      consider(readyAt);
    }
  }
  for (const wave of state.waves) {
    for (const entry of wave.tiles) {
      consider(entry.arrivalAt);
    }
  }
  for (const projectile of state.projectiles ?? []) {
    consider(projectile.impactAt);
  }
  for (const spawn of state.spawns) {
    consider(spawn.respawnAt);
  }
  consider(state.endsAt);
  consider(until);
  return next;
}

function closeAtWindowEnd(state: SimState): void {
  state.ended = true;
  if (state.endReason === null) {
    state.endReason = 'offline_session_expired';
  }
}

function readLivingMember(state: SimState, id: string): SimTeamMember | null {
  for (const member of state.team) {
    if (member.id === id && isAlive(member)) {
      return member;
    }
  }
  return null;
}
