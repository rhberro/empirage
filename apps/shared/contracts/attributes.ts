import type { Creature, CreatureSpecies, Potential } from './creature';

/**
 * The current attributes of a creature.
 *
 * The attributes are not stored: they are derived from the base value of the
 * species, the potential of the individual and the level.
 *
 * ```
 * Atributo = floor( Base × (1 − d + 2d × PV/100) × (1 + (Nível − 1) × k) )
 * ```
 *
 * `d` is how much the potential weighs: the worst potential takes 30% off the
 * base value and the best one adds 30% to it. `k` is how much a creature grows
 * with the level: 5% of the base value for each level above the first.
 *
 * A potential of 50% leaves the base value untouched, which is what a creature
 * born with every potential at 50% must have.
 */

/** How much the potential weighs on the attribute, from the worst to the best. */
export const POTENTIAL_DEVIATION = 0.3;

/** How much the attribute grows for each level above the first. */
export const LEVEL_GROWTH = 0.05;

const MIN_POTENTIAL_PERCENT = 0;
const MAX_POTENTIAL_PERCENT = 100;
const MIN_LEVEL = 1;
const POTENTIAL_COUNT = 5;

/**
 * The current value of one attribute of a creature.
 */
export function calculateAttribute(base: number, potentialPercent: number, level: number): number {
  const potential = clamp(potentialPercent, MIN_POTENTIAL_PERCENT, MAX_POTENTIAL_PERCENT);
  const safeLevel = Math.max(MIN_LEVEL, level);
  const potentialFactor = 1 - POTENTIAL_DEVIATION + 2 * POTENTIAL_DEVIATION * (potential / 100);
  const levelFactor = 1 + (safeLevel - 1) * LEVEL_GROWTH;
  return Math.floor(base * potentialFactor * levelFactor);
}

/**
 * The maximum life of a creature is its vitality attribute.
 */
export function calculateMaxHp(
  baseVitality: number,
  potentialVitality: number,
  level: number,
): number {
  return calculateAttribute(baseVitality, potentialVitality, level);
}

/**
 * The life left of a creature.
 *
 * The stored value is null until the creature takes a hit, and a null life is
 * the same as a full life.
 */
export function resolveCurrentHp(storedHp: number | null, maxHp: number): number {
  if (storedHp === null) {
    return maxHp;
  }
  return Math.min(storedHp, maxHp);
}

/**
 * The five current attributes of a creature.
 */
export type CreatureAttributes = {
  magicAttack: number;
  magicDefense: number;
  physicalAttack: number;
  physicalDefense: number;
  vitality: number;
};

/**
 * The current attributes of a creature, calculated from its species, its
 * potential and its level.
 */
export function computeCreatureAttributes(creature: Creature): CreatureAttributes {
  const { level, potential, species } = creature;
  return {
    magicAttack: calculateAttribute(species.baseMagicAttack, potential.magicAttack, level),
    magicDefense: calculateAttribute(species.baseMagicDefense, potential.magicDefense, level),
    physicalAttack: calculateAttribute(species.basePhysicalAttack, potential.physicalAttack, level),
    physicalDefense: calculateAttribute(
      species.basePhysicalDefense,
      potential.physicalDefense,
      level,
    ),
    vitality: calculateAttribute(species.baseVitality, potential.vitality, level),
  };
}

/**
 * The maximum potential of a creature: the average of its five potentials.
 *
 * A creature with every potential at 100% has a maximum potential of 100%, and
 * is a creature that reaches the ceiling of the species.
 */
export function calculateMaximumPotential(potential: Potential): number {
  const total =
    potential.vitality +
    potential.physicalAttack +
    potential.magicAttack +
    potential.physicalDefense +
    potential.magicDefense;
  return Math.round(total / POTENTIAL_COUNT);
}

/**
 * The base values of a species: the BVs of a creature.
 */
export function readBaseValues(species: CreatureSpecies): CreatureAttributes {
  return {
    magicAttack: species.baseMagicAttack,
    magicDefense: species.baseMagicDefense,
    physicalAttack: species.basePhysicalAttack,
    physicalDefense: species.basePhysicalDefense,
    vitality: species.baseVitality,
  };
}

/**
 * The total experience a creature needs to reach the level `level`.
 *
 * The curve is quadratic: `100 × (level − 1)²`. Level 2 needs 100, level 3
 * needs 400, level 4 needs 900, and so on.
 */
export function experienceForLevel(level: number): number {
  const safe = Math.max(MIN_LEVEL, level);
  return 100 * (safe - 1) * (safe - 1);
}

/**
 * The level a creature has with the given total experience.
 *
 * It is the inverse of {@link experienceForLevel}: `floor(√(xp / 100)) + 1`.
 */
export function levelForExperience(experience: number): number {
  if (experience < 0) {
    return MIN_LEVEL;
  }
  return Math.floor(Math.sqrt(experience / 100)) + 1;
}

/**
 * The experience the next level requires on top of the current one.
 */
export function experienceForNextLevel(level: number): number {
  return experienceForLevel(level + 1) - experienceForLevel(level);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
