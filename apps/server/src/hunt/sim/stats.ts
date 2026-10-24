import { calculateAttribute, calculateMaxHp } from '@creatures/contracts/attributes';
import type { Direction, Tile } from '@creatures/contracts/world';

import type {
  SimAbility,
  SimAttributeSet,
  SimContent,
  SimCreature,
  SimSpecies,
} from '~/hunt/sim/types';

/** How much of the ability power becomes damage. */
const DAMAGE_SCALE = 0.25;

/** How much a level above the first adds to the power, in percent. */
const LEVEL_GROWTH = 0.05;

/**
 * What is needed to build a runtime creature.
 */
export type CreateCreatureInput = {
  behavior?: SimCreature['behavior'];
  dir?: Direction;
  hp: number | null;
  id: string;
  kind: 'player' | 'wild';
  level: number;
  potential: SimAttributeSet;
  species: SimSpecies;
  tile: Tile;
};

/**
 * Builds the runtime of one creature from its species, its potential and its
 * level.
 *
 * The attributes and the maximum life come from the same formulas the rest of
 * the game uses, so a creature fights here exactly as it does in the city.
 */
export function createCreatureFromSpecies(input: CreateCreatureInput): SimCreature {
  const { behavior, dir, hp, id, kind, level, potential, species, tile } = input;
  const base = species.base;
  const attributes: SimAttributeSet = {
    magicAttack: calculateAttribute(base.magicAttack, potential.magicAttack, level),
    magicDefense: calculateAttribute(base.magicDefense, potential.magicDefense, level),
    physicalAttack: calculateAttribute(base.physicalAttack, potential.physicalAttack, level),
    physicalDefense: calculateAttribute(base.physicalDefense, potential.physicalDefense, level),
    vitality: calculateAttribute(base.vitality, potential.vitality, level),
  };
  const maxHp = calculateMaxHp(base.vitality, potential.vitality, level);
  return {
    abilityReadyAt: [],
    attributes,
    behavior: behavior ?? 'idle',
    consumableReadyAt: [],
    dir: dir ?? 'down',
    hp: resolveHp(hp, maxHp),
    id,
    kind,
    level,
    loopIndex: 0,
    maxHp,
    meleeReadyAt: 0,
    nextAbilityAt: 0,
    nextDecisionAt: 0,
    speciesSlug: species.slug,
    targetId: null,
    tile: { x: tile.x, y: tile.y },
    trail: [{ x: tile.x, y: tile.y }],
    wildReadyAt: {},
  };
}

/**
 * The damage of an ability, using the element to pick the attack and the
 * defense of the two sides.
 */
export function computeAbilityDamage(
  ability: SimAbility,
  attacker: SimAttackerLike,
  defender: SimAttackerLike,
  effectiveness: number,
): number {
  return computeDamage(ability.damage, ability.element, attacker, defender, effectiveness);
}

/**
 * The damage of the implicit melee of the wilds.
 *
 * It has no ability power: the physical attack of the attacker is the power.
 */
export function computeMeleeDamage(attacker: SimAttackerLike, defender: SimAttackerLike): number {
  return computeDamage(attacker.attributes.physicalAttack, 'neutral', attacker, defender, 1);
}

/**
 * The multiplier of an element against the element of a defender species.
 */
export function effectivenessFor(
  content: SimContent,
  element: string,
  defenderSpeciesSlug: string,
): number {
  const species = content.species[defenderSpeciesSlug];
  if (species === undefined) {
    return 1;
  }
  return content.effectiveness[`${element}:${species.element}`] ?? 1;
}

/**
 * The two values the damage formula reads from a creature.
 */
export type SimAttackerLike = {
  attributes: SimAttributeSet;
  level: number;
};

function computeDamage(
  power: number,
  element: string,
  attacker: SimAttackerLike,
  defender: SimAttackerLike,
  effectiveness: number,
): number {
  const levelFactor = 1 + (attacker.level - 1) * LEVEL_GROWTH;
  const physical = element === 'neutral';
  const attack = physical ? attacker.attributes.physicalAttack : attacker.attributes.magicAttack;
  const defense = physical ? defender.attributes.physicalDefense : defender.attributes.magicDefense;
  const total = attack + defense;
  const ratio = total > 0 ? attack / total : 0;
  const damage = power * levelFactor * DAMAGE_SCALE * ratio * effectiveness;
  return Math.max(1, Math.round(damage));
}

function resolveHp(hp: number | null, maxHp: number): number {
  if (hp === null) {
    return maxHp;
  }
  return Math.max(0, Math.min(hp, maxHp));
}
