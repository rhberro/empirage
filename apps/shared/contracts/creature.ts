import type { Element } from './species';

export type Potential = {
  vitality: number;
  physicalAttack: number;
  magicAttack: number;
  physicalDefense: number;
  magicDefense: number;
};

/**
 * The species of a creature, reduced to what the interface shows.
 *
 * The full species lives in the catalog; a creature carries the reference to
 * it, and the interface needs the name and the element to draw the tab.
 */
export type SpeciesSummary = {
  element: Element;
  id: string;
  name: string;
  slug: string;
};

/**
 * The species of a creature, with the values of base (BVs).
 *
 * Os BVs vem junto porque a interface mostra os atributos calculados da
 * criatura, e o calculo precisa do valor base da especie.
 */
export type CreatureSpecies = SpeciesSummary & {
  /** The base value of the magic attack of the species. */
  baseMagicAttack: number;
  /** The base value of the magic defense of the species. */
  baseMagicDefense: number;
  /** The base value of the physical attack of the species. */
  basePhysicalAttack: number;
  /** The base value of the physical defense of the species. */
  basePhysicalDefense: number;
  /** The base value of the vitality of the species. */
  baseVitality: number;
};

/**
 * A creature: one individual of a species, owned by a trainer.
 *
 * The values that change over the creature's life are the potential and the
 * level. The attributes and the level formula are not written yet, so the
 * interface cannot show a derived attribute yet.
 */
export type Creature = {
  capturedAt: string | null;
  createdAt: string;
  experience: number;
  id: string;
  isInTeam: boolean;
  level: number;
  nickname: string | null;
  potential: Potential;
  species: CreatureSpecies;
  speciesId: string;
  teamSlot: number | null;
  trainerId: string;
};

/**
 * One ability of a species, in the slot it occupies.
 *
 * The slot is what the skill bar draws: the abilities of the active creature
 * fill the four ability slots in the order the species declares them.
 */
export type CreatureAbility = {
  abilityId: string;
  cooldownMs: number;
  damage: number;
  description?: string;
  element: Element;
  name: string;
  slot: number;
  slug: string;
};
