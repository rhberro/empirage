import type { Creature, CreatureSpecies } from '@creatures/contracts/creature';
import type { CreatureAbility } from '@creatures/contracts/creature';
import type {
  CreatureVitals,
  EquippedAbility,
  EquippedConsumable,
  EquippedDevice,
} from '@creatures/contracts/skill';

import type { CreatureSlot } from './gameHud.types';

const SAMPLE_DATE = '2026-01-01T00:00:00.000Z';
const SAMPLE_TRAINER_ID = 'trainer-sample';

/**
 * The sample team of the design gallery.
 *
 * The game screen never reads it: the team of the player comes from the
 * server, as a `PlayerState`. This file only feeds the gallery, which needs a
 * team to draw the tabs.
 */
export const TEAM_SLOTS: CreatureSlot[] = [
  buildSampleCreature({
    id: 'c1',
    level: 33,
    nickname: 'Fagulha',
    slot: 1,
    species: {
      baseMagicAttack: 4,
      baseMagicDefense: 2,
      basePhysicalAttack: 8,
      basePhysicalDefense: 7,
      baseVitality: 22,
      element: 'fire',
      id: 'species-c1',
      name: 'Cinzarra',
      slug: 'cinzarra',
    },
  }),
  buildSampleCreature({
    id: 'c2',
    level: 14,
    nickname: null,
    slot: 2,
    species: {
      baseMagicAttack: 4,
      baseMagicDefense: 2,
      basePhysicalAttack: 8,
      basePhysicalDefense: 7,
      baseVitality: 22,
      element: 'plant',
      id: 'species-c2',
      name: 'Brotus',
      slug: 'brotus',
    },
  }),
  buildSampleCreature({
    id: 'c3',
    level: 8,
    nickname: 'Gotinho',
    slot: 3,
    species: {
      baseMagicAttack: 4,
      baseMagicDefense: 2,
      basePhysicalAttack: 8,
      basePhysicalDefense: 7,
      baseVitality: 22,
      element: 'water',
      id: 'species-c3',
      name: 'Gotim',
      slug: 'gotim',
    },
  }),
  null,
  null,
];

export const ACTIVE_CREATURE_ID = 'c1';

/**
 * The sample abilities of the active creature, for the gallery.
 *
 * The bar of the game reads the abilities from the state of the player: this
 * sample only exists so that the gallery draws the bar with the same data the
 * game draws.
 */
export const SAMPLE_ABILITIES: CreatureAbility[] = [
  {
    abilityId: 'ability-1',
    cooldownMs: 4000,
    damage: 12,
    element: 'fire',
    name: 'Brasa',
    slot: 1,
    slug: 'brasa',
  },
  {
    abilityId: 'ability-2',
    cooldownMs: 7000,
    damage: 20,
    element: 'fire',
    name: 'Ígnea',
    slot: 2,
    slug: 'ignea',
  },
  {
    abilityId: 'ability-3',
    cooldownMs: 2000,
    damage: 8,
    element: 'neutral',
    name: 'Garra',
    slot: 3,
    slug: 'garra',
  },
  {
    abilityId: 'ability-4',
    cooldownMs: 1000,
    damage: 5,
    element: 'water',
    name: 'Jato',
    slot: 4,
    slug: 'jato',
  },
];

/**
 * The sample load of the skill bar, for the gallery.
 *
 * The bar of the game reads the load from the state of the player: this
 * sample only exists so that the gallery draws the bar with the same data the
 * game draws.
 */
export const SAMPLE_EQUIPPED_ABILITIES: EquippedAbility[] = [
  {
    abilityId: 'ability-1',
    cooldownMs: 4000,
    damage: 12,
    element: 'fire',
    name: 'Brasa',
    slot: 0,
    slug: 'brasa',
  },
  {
    abilityId: 'ability-2',
    cooldownMs: 7000,
    damage: 20,
    element: 'fire',
    name: 'Ígnea',
    slot: 1,
    slug: 'ignea',
  },
  {
    abilityId: 'ability-3',
    cooldownMs: 2000,
    damage: 8,
    element: 'neutral',
    name: 'Garra',
    slot: 2,
    slug: 'garra',
  },
];

export const SAMPLE_EQUIPPED_CONSUMABLES: EquippedConsumable[] = [
  {
    itemId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    name: 'Poção de Cura',
    quantity: 93,
    slot: 4,
    triggerHpPercent: 30,
  },
];

export const SAMPLE_EQUIPPED_DEVICE: EquippedDevice = {
  itemId: '4e5f6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8b',
  name: 'Prisma Simples',
  quantity: 2,
  slot: 6,
};

export const SAMPLE_VITALS: CreatureVitals = { currentHp: 68, maxHp: 120 };

type SampleCreatureInput = {
  id: string;
  level: number;
  nickname: string | null;
  slot: number;
  species: CreatureSpecies;
};

function buildSampleCreature(input: SampleCreatureInput): Creature {
  return {
    capturedAt: null,
    createdAt: SAMPLE_DATE,
    experience: 0,
    id: input.id,
    isInTeam: true,
    level: input.level,
    nickname: input.nickname,
    potential: {
      magicAttack: 50,
      magicDefense: 50,
      physicalAttack: 50,
      physicalDefense: 50,
      vitality: 50,
    },
    species: input.species,
    speciesId: input.species.id,
    teamSlot: input.slot,
    trainerId: SAMPLE_TRAINER_ID,
  };
}
