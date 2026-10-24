/* eslint-disable max-lines -- the simulation types stay together so a checkpoint reads as one shape */
import type { HuntMap } from '@creatures/contracts/huntMap';
import type { HuntEndReason } from '@creatures/contracts/huntSession';
import type { HuntLedger, HuntRuntimeEvent } from '@creatures/contracts/huntSim';
import type { Element } from '@creatures/contracts/species';
import type { Direction, PathSegment, Tile } from '@creatures/contracts/world';

import type { HuntRandomState } from '~/hunt/rng';

/**
 * The five attributes a simulation reads.
 *
 * The values are already derived from the base values, the potential and the
 * level, so the simulation never has to look at the species again to know how
 * hard a creature hits or how much it can take.
 */
export type SimAttributeSet = {
  magicAttack: number;
  magicDefense: number;
  physicalAttack: number;
  physicalDefense: number;
  vitality: number;
};

/**
 * One ability, with the geometry and the timings the simulation needs.
 *
 * The ability is content: the same object is shared by every creature of the
 * species, and nothing here changes during a hunt.
 */
export type SimAbility = {
  areaLength: number | null;
  areaRadius: number | null;
  areaShape: 'line' | 'circle' | null;
  areaStepMs: number;
  cooldownMs: number;
  damage: number;
  element: Element;
  name: string;
  range: number;
  slug: string;
  targetType: 'area' | 'area_self' | 'target';
  travelMs: number;
};

/**
 * A wild ability, with the chance and the interval of its wild use.
 */
export type SimSpeciesAbility = {
  ability: SimAbility;
  wildChance: number;
  wildIntervalMs: number;
};

/**
 * A drop of a species.
 */
export type SimDrop = {
  chance: number;
  itemId: string;
  name: string;
};

/**
 * A species, reduced to what the simulation reads.
 */
export type SimSpecies = {
  abilities: SimSpeciesAbility[];
  base: SimAttributeSet;
  baseExperience: number;
  /** The chance a captured wild of this species is caught, from zero to one. */
  captureChance: number;
  drops: SimDrop[];
  element: Element;
  name: string;
  slug: string;
};

/**
 * The capture device the trainer carries into the hunt.
 *
 * It is trainer level, not creature level: the same device is used by every
 * member of the team and is consumed on every capture attempt.
 */
export type SimDevice = {
  itemId: string;
  multiplier: number;
  name: string;
  quantity: number;
  slot: number;
};

/**
 * Everything the simulation needs from the area and the catalog.
 *
 * The content is immutable during a hunt: a state only holds a reference to it,
 * which is what keeps the persisted state small.
 */
export type SimContent = {
  effectiveness: Record<string, number>;
  map: HuntMap;
  species: Record<string, SimSpecies>;
};

/**
 * A consumable equipped in one of the two slots of the bar.
 */
export type SimConsumable = {
  cooldownMs: number;
  healPercent: number;
  itemId: string;
  name: string;
  quantity: number;
  slot: number;
  triggerHpPercent: number;
};

/**
 * The configuration of a creature the trainer brings to the hunt.
 *
 * It is the durable part: the current life, the level, the potential and what
 * is equipped. The simulation turns it into a `SimTeamMember`.
 */
export type SimTeamMemberInput = {
  abilities: (SimAbility | null)[];
  consumables: SimConsumable[];
  creatureId: string;
  currentHp: number | null;
  experience: number;
  level: number;
  potential: SimAttributeSet;
  speciesSlug: string;
  /** The team slot (1–5) the creature occupies in the city. */
  teamSlot?: number;
};

/**
 * One creature of the player in the field.
 *
 * The team keeps every member, alive or dead, because the cooldowns, the
 * experience and the life of the creatures that are not active still have to
 * survive a swap.
 */
export type SimTeamMember = SimCreature & {
  abilities: (SimAbility | null)[];
  consumables: SimConsumable[];
  creatureId: string;
  experience: number;
  potential: SimAttributeSet;
  teamSlot: number;
};

/**
 * The runtime of a creature, player or wild.
 */
export type SimCreature = {
  abilityReadyAt: (number | null)[];
  attributes: SimAttributeSet;
  behavior: 'loop' | 'chase' | 'idle' | 'return' | 'dead';
  /**
   * When a dead wild is resolved by the capture step. A living wild and a wild
   * that is not a corpse have no instant here.
   */
  captureAt?: number | null;
  consumableReadyAt: number[];
  dir: Direction;
  hp: number;
  id: string;
  kind: 'player' | 'wild';
  level: number;
  loopIndex: number;
  maxHp: number;
  meleeReadyAt: number;
  nextAbilityAt: number;
  nextDecisionAt: number;
  segment?: PathSegment;
  speciesSlug: string;
  targetId: string | null;
  tile: Tile;
  trail: Tile[];
  wildReadyAt: Record<string, number>;
  encountered?: boolean;
  spawnIndex?: number;
  spawnTile?: Tile;
};

/**
 * The trainer that follows the active creature.
 *
 * The trainer never fights: it only keeps a trail so the client can draw it
 * behind the creature. It does block its tile like any other actor, so the
 * active creature and the wilds never walk through it.
 */
export type SimTrainer = {
  dir: Direction;
  segment?: PathSegment;
  tile: Tile;
  trail: Tile[];
};

/**
 * The static values of a caster, snapshotted on the wave.
 *
 * A wave outlives its caster, and the damage it deals still uses the attack and
 * the level the caster had when the cast happened.
 */
export type SimAttacker = {
  attributes: SimAttributeSet;
  level: number;
};

/**
 * A targeted ability in flight.
 *
 * The damage is computed at the cast and frozen with the attacker, so the death
 * of the caster before the impact does not change what the projectile deals.
 */
export type SimProjectile = {
  ability: SimAbility;
  attacker: SimAttacker;
  casterId: string;
  casterKind: 'player' | 'wild';
  damage: number;
  element: Element;
  id: string;
  impactAt: number;
  targetId: string;
};

/**
 * An area wave on its way through the tiles.
 */
export type SimWave = {
  ability: SimAbility;
  abilitySlug: string;
  attacker: SimAttacker;
  casterId: string;
  casterKind: 'player' | 'wild';
  element: Element;
  hitIds: string[];
  id: string;
  startedAt: number;
  tiles: { arrivalAt: number; tile: Tile }[];
};

/**
 * One spawn point of the area, with what occupies it now.
 */
export type SimSpawn = {
  index: number;
  respawnAt: number | null;
  wildId: string | null;
};

/**
 * The whole state of a hunt.
 *
 * It is serializable on purpose: the runner checkpoints it as JSON and resumes
 * from it without replaying a single draw. There is no clock and no generator
 * inside it, only the cursor (`simulatedAt`) and the random counter.
 */
export type SimState = {
  activeCreatureId: string;
  areaSlug: string;
  /** The capture device of the trainer, when one is equipped. */
  device: SimDevice | null;
  ended: boolean;
  endReason: HuntEndReason | null;
  endsAt: number;
  lastSwapAt: number;
  ledger: HuntLedger;
  loopIndex: number;
  nextWaveId: number;
  projectiles: SimProjectile[];
  rng: HuntRandomState;
  simulatedAt: number;
  spawns: SimSpawn[];
  team: SimTeamMember[];
  trainer: SimTrainer;
  waves: SimWave[];
  wilds: SimCreature[];
};

/**
 * The facts the simulation produces.
 *
 * They reuse the protocol type, so the runner can publish the list with no
 * translation step.
 */
export type SimEvent = HuntRuntimeEvent;

/**
 * Whether a creature is still in the fight.
 */
export function isAlive(creature: { hp: number }): boolean {
  return creature.hp > 0;
}

/**
 * The creature of the player that is in the field.
 *
 * The team is never empty, so the fallback is a member and not an invented
 * creature: a state with an id that points nowhere is a bug, not a situation.
 */
export function activeCreature(state: SimState): SimTeamMember {
  for (const member of state.team) {
    if (member.id === state.activeCreatureId) {
      return member;
    }
  }
  return state.team[0] as SimTeamMember;
}

/**
 * Whether two tiles are the same square.
 */
export function sameTile(left: Tile, right: Tile): boolean {
  return left.x === right.x && left.y === right.y;
}
