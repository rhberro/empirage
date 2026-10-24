import { randomUUID } from 'node:crypto';

import {
  calculateAttribute,
  calculateMaxHp,
  levelForExperience,
} from '@creatures/contracts/attributes';
/* eslint-disable max-lines -- the death, capture and level rules share the combat state */
import type { Potential } from '@creatures/contracts/creature';
import type { HuntLedger } from '@creatures/contracts/huntSim';
import type { Tile } from '@creatures/contracts/world';
import { isWalkableTile } from '@creatures/contracts/world';

import { drawInt, drawUnit } from '~/hunt/rng';
import { findFreeTileNear } from '~/hunt/sim/occupancy';
import { createCreatureFromSpecies } from '~/hunt/sim/stats';
import type {
  SimAttributeSet,
  SimContent,
  SimCreature,
  SimEvent,
  SimState,
  SimTeamMember,
} from '~/hunt/sim/types';
import { activeCreature, isAlive } from '~/hunt/sim/types';
import {
  cloneTile,
  createWild,
  isOccupied,
  readRespawnMs,
  RESPAWN_RETRY_MS,
  WILD_DECISION_MS,
} from '~/hunt/sim/world';

/** The weight of the experience of the creatures that are not active. */
const BENCH_EXPERIENCE_SHARE = 0.1;

/** How much a level above the first adds to the experience of a wild. */
const WILD_LEVEL_EXPERIENCE_GROWTH = 0.1;

/** How long a dead wild stays on the ground before the capture attempt. */
export const CORPSE_LINGER_MS = 3000;

/** The team slots a captured creature can enter. */
const TEAM_SLOT_COUNT = 5;

/** The highest potential a captured creature can roll. */
const MAX_POTENTIAL = 100;

/**
 * Resolves the death of the wilds and of the active creature.
 *
 * A dead wild becomes a corpse on the ground: it counts a kill, publishes the
 * death and shares its experience immediately, but its loot and the respawn of
 * its spawn wait for the capture attempt, a few seconds later. A dead active
 * leaves the field, and the next living member of the team takes its tile, or a
 * free neighbor when another actor is there; when there is none, the hunt ends
 * at that exact instant.
 */
export function resolveDeaths(
  state: SimState,
  content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  for (const wild of state.wilds) {
    if (!isAlive(wild) && wild.behavior !== 'dead') {
      resolveWildDeath(state, content, wild, now, events);
    }
  }
  const active = activeCreature(state);
  if (active.hp <= 0 && active.behavior !== 'dead') {
    active.behavior = 'dead';
    active.segment = undefined;
    events.push({ actorId: active.id, at: now, type: 'death' });
    swapAfterDeath(state, content, now);
  }
}

/**
 * Resolves the corpses whose capture attempt is due.
 *
 * A wild with an equipped device rolls the capture chance of its species times
 * the multiplier of the device. A captured wild leaves the field for the team
 * (or for the storage, when the team is full); a wild that escapes, or a wild
 * with no device, drops its loot and frees its spawn.
 */
export function resolveCaptures(
  state: SimState,
  content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  const remaining: SimCreature[] = [];
  for (const wild of state.wilds) {
    const captureAt = wild.captureAt;
    if (
      wild.behavior === 'dead' &&
      captureAt !== null &&
      captureAt !== undefined &&
      captureAt <= now
    ) {
      resolveCapture(state, content, wild, now, events);
      continue;
    }
    remaining.push(wild);
  }
  state.wilds = remaining;
}

/**
 * Brings back the wilds whose respawn delay is over.
 *
 * A busy spawn waits another second and never draws from the random stream
 * while it waits, so the order of the draws only depends on the spawns that
 * really came back.
 */
export function respawnWilds(
  state: SimState,
  content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  for (const spawn of state.spawns) {
    if (spawn.respawnAt === null || spawn.respawnAt > now) {
      continue;
    }
    const definition = content.map.spawns[spawn.index];
    if (definition === undefined) {
      continue;
    }
    const tile = { x: definition.x, y: definition.y };
    if (isOccupied(state, tile)) {
      spawn.respawnAt = now + RESPAWN_RETRY_MS;
      continue;
    }
    const decision = drawInt(state.rng, WILD_DECISION_MS);
    state.rng = decision.state;
    const wild = createWild(content, spawn.index, now, now + decision.value);
    if (wild === null) {
      spawn.respawnAt = now + RESPAWN_RETRY_MS;
      continue;
    }
    state.wilds.push(wild);
    spawn.respawnAt = null;
    spawn.wildId = wild.id;
    events.push({
      actorId: wild.id,
      at: now,
      spawnIndex: spawn.index,
      speciesSlug: wild.speciesSlug,
      type: 'spawn',
    });
  }
}

function resolveWildDeath(
  state: SimState,
  content: SimContent,
  wild: SimCreature,
  now: number,
  events: SimEvent[],
): void {
  wild.behavior = 'dead';
  wild.hp = 0;
  wild.segment = undefined;
  wild.targetId = null;
  wild.captureAt = now + CORPSE_LINGER_MS;
  state.ledger.kills += 1;
  events.push({
    actorId: wild.id,
    at: now,
    killerId: state.activeCreatureId,
    type: 'death',
  });
  const species = content.species[wild.speciesSlug];
  if (species === undefined) {
    return;
  }
  grantExperience(state, content, species, wild, now, events);
}

function resolveCapture(
  state: SimState,
  content: SimContent,
  wild: SimCreature,
  now: number,
  events: SimEvent[],
): void {
  freeSpawn(state, content, wild, now);
  const species = content.species[wild.speciesSlug];
  if (species === undefined) {
    return;
  }
  const device = state.device;
  if (device === null || device.quantity <= 0) {
    rollLoot(state, species, now, events);
    return;
  }
  device.quantity -= 1;
  const roll = drawUnit(state.rng);
  state.rng = roll.state;
  const success = roll.value < species.captureChance * device.multiplier;
  if (!success) {
    rollLoot(state, species, now, events);
    events.push(readCaptureEvent(wild, now, device.itemId, false));
    return;
  }
  const potential = readCapturePotential(state);
  const teamSlot = readVacantTeamSlot(state);
  const creatureId = randomUUID();
  addCapturedMember(state, content, wild, potential, teamSlot, creatureId);
  events.push(readCaptureEvent(wild, now, device.itemId, true, potential, teamSlot, creatureId));
}

/**
 * The corpse frees the spawn whether it is captured or not: the area keeps
 * spawning the species after the attempt.
 */
function freeSpawn(state: SimState, content: SimContent, wild: SimCreature, now: number): void {
  const spawn = state.spawns[wild.spawnIndex ?? -1];
  if (spawn !== undefined) {
    spawn.respawnAt = now + readRespawnMs(content, spawn.index);
    spawn.wildId = null;
  }
}

function readCaptureEvent(
  wild: SimCreature,
  now: number,
  deviceItemId: string,
  success: boolean,
  potential?: Potential,
  teamSlot?: number,
  creatureId?: string,
): Extract<SimEvent, { type: 'capture' }> {
  const event: Extract<SimEvent, { type: 'capture' }> = {
    actorId: wild.id,
    at: now,
    deviceItemId,
    speciesSlug: wild.speciesSlug,
    success,
    type: 'capture',
  };
  if (creatureId !== undefined) {
    event.creatureId = creatureId;
  }
  if (potential !== undefined) {
    event.potential = potential;
  }
  if (teamSlot !== undefined) {
    event.teamSlot = teamSlot;
  }
  return event;
}

function rollLoot(
  state: SimState,
  species: SimContent['species'][string],
  now: number,
  events: SimEvent[],
): void {
  for (const drop of species.drops) {
    const draw = drawUnit(state.rng);
    state.rng = draw.state;
    if (draw.value >= drop.chance) {
      continue;
    }
    addDrop(state.ledger.drops, drop.itemId, drop.name, 1);
    events.push({
      actorId: state.activeCreatureId,
      at: now,
      itemId: drop.itemId,
      name: drop.name,
      quantity: 1,
      type: 'loot',
    });
  }
}

function grantExperience(
  state: SimState,
  content: SimContent,
  species: SimContent['species'][string],
  wild: SimCreature,
  now: number,
  events: SimEvent[],
): void {
  const xp = Math.round(
    species.baseExperience * (1 + (wild.level - 1) * WILD_LEVEL_EXPERIENCE_GROWTH),
  );
  state.ledger.experience += xp;
  const active = activeCreature(state);
  if (!isAlive(active)) {
    return;
  }
  active.experience += xp;
  events.push({ actorId: active.id, amount: xp, at: now, type: 'experience' });
  const share = Math.round(xp * BENCH_EXPERIENCE_SHARE);
  for (const member of state.team) {
    if (member.id !== active.id && isAlive(member)) {
      member.experience += share;
    }
  }
  for (const member of state.team) {
    grantLevel(member, content, now, events);
  }
}

/**
 * Recomputes the level of a member from its total experience.
 *
 * A level up recomputes the attributes and the maximum life with the same
 * formulas of the city, and heals the creature by the difference so a hit does
 * not undo the progress of the level.
 */
function grantLevel(
  member: SimTeamMember,
  content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  const level = levelForExperience(member.experience);
  if (level <= member.level) {
    return;
  }
  const species = content.species[member.speciesSlug];
  if (species === undefined) {
    return;
  }
  const previousMaxHp = member.maxHp;
  member.level = level;
  member.attributes = computeAttributes(species.base, member.potential, level);
  member.maxHp = calculateMaxHp(species.base.vitality, member.potential.vitality, level);
  member.hp = Math.min(member.maxHp, member.hp + (member.maxHp - previousMaxHp));
  events.push({ actorId: member.id, at: now, level, type: 'level_up' });
}

function computeAttributes(
  base: SimAttributeSet,
  potential: SimAttributeSet,
  level: number,
): SimAttributeSet {
  return {
    magicAttack: calculateAttribute(base.magicAttack, potential.magicAttack, level),
    magicDefense: calculateAttribute(base.magicDefense, potential.magicDefense, level),
    physicalAttack: calculateAttribute(base.physicalAttack, potential.physicalAttack, level),
    physicalDefense: calculateAttribute(base.physicalDefense, potential.physicalDefense, level),
    vitality: calculateAttribute(base.vitality, potential.vitality, level),
  };
}

function readCapturePotential(state: SimState): Potential {
  return {
    magicAttack: drawPotential(state),
    magicDefense: drawPotential(state),
    physicalAttack: drawPotential(state),
    physicalDefense: drawPotential(state),
    vitality: drawPotential(state),
  };
}

function drawPotential(state: SimState): number {
  const draw = drawInt(state.rng, MAX_POTENTIAL + 1);
  state.rng = draw.state;
  return draw.value;
}

/**
 * The first team slot with no member, or null when the team is full.
 */
function readVacantTeamSlot(state: SimState): number | undefined {
  if (state.team.length >= TEAM_SLOT_COUNT) {
    return undefined;
  }
  const used = new Set<number>();
  for (const member of state.team) {
    used.add(member.teamSlot);
  }
  for (let slot = 1; slot <= TEAM_SLOT_COUNT; slot += 1) {
    if (!used.has(slot)) {
      return slot;
    }
  }
  return undefined;
}

/**
 * Puts the captured creature in the team, born with the base attributes.
 *
 * The captured creature enters without abilities and consumables: the trainer
 * equips it later, in the city. A team that is already full sends the capture
 * to the storage, which is a row the runtime writes and the simulation does not
 * track.
 */
function addCapturedMember(
  state: SimState,
  content: SimContent,
  wild: SimCreature,
  potential: Potential,
  teamSlot: number | undefined,
  creatureId: string,
): void {
  if (teamSlot === undefined) {
    return;
  }
  const species = content.species[wild.speciesSlug];
  if (species === undefined) {
    return;
  }
  const creature = createCreatureFromSpecies({
    behavior: 'loop',
    dir: 'down',
    hp: null,
    id: creatureId,
    kind: 'player',
    level: 1,
    potential,
    species,
    tile: wild.tile,
  });
  const member: SimTeamMember = {
    ...creature,
    abilities: [null, null, null, null],
    abilityReadyAt: [null, null, null, null],
    consumableReadyAt: [],
    consumables: [],
    creatureId,
    experience: 0,
    potential,
    teamSlot,
  };
  state.team.push(member);
}

function swapAfterDeath(state: SimState, content: SimContent, now: number): void {
  const dead = activeCreature(state);
  const next = readFirstLivingMember(state, dead.id);
  if (next === null) {
    state.ended = true;
    state.endReason = 'no_viable_creature';
    state.endsAt = now;
    return;
  }
  // The dead creature leaves the field, so its tile stops blocking. When a
  // wild or the trainer happens to be there, the newcomer takes a free and
  // walkable neighbor; the trail restarts from wherever it ended up.
  const tile = findFreeTileNear(
    state,
    dead.tile,
    dead.id,
    function isWalkable(candidate: Tile): boolean {
      return isWalkableTile(content.map, candidate);
    },
  );
  next.behavior = 'loop';
  next.dir = dead.dir;
  next.loopIndex = state.loopIndex;
  next.segment = undefined;
  next.targetId = null;
  next.tile = tile;
  next.trail = [cloneTile(tile)];
  state.activeCreatureId = next.id;
  state.trainer.trail = [cloneTile(tile)];
}

function readFirstLivingMember(state: SimState, exceptId: string): SimState['team'][number] | null {
  for (const member of state.team) {
    if (member.id !== exceptId && isAlive(member)) {
      return member;
    }
  }
  return null;
}

function addDrop(drops: HuntLedger['drops'], itemId: string, name: string, quantity: number): void {
  for (const item of drops) {
    if (item.itemId === itemId) {
      item.quantity += quantity;
      return;
    }
  }
  drops.push({ itemId, name, quantity });
}
