import type { Creature } from '@creatures/contracts/creature';
import type { TeamSlot } from '@creatures/contracts/player';
import type { Element } from '@creatures/contracts/species';
import type { ReactElement } from 'react';

import type { TeamView } from '~/entities/team';
import { StorageModal } from '~/features/storage';

type CreatureSample = {
  element: Element;
  id: string;
  level: number;
  name: string;
  slug: string;
  slot: number | null;
};

const TEAM_SAMPLES: CreatureSample[] = [
  { element: 'fire', id: 'brasa', level: 4, name: 'Brasa', slot: 1, slug: 'brasa' },
  { element: 'water', id: 'gota', level: 3, name: 'Gota', slot: 2, slug: 'gota' },
  { element: 'plant', id: 'broto', level: 2, name: 'Broto', slot: 3, slug: 'broto' },
  { element: 'fire', id: 'cinzarra', level: 5, name: 'Cinzarra', slot: 4, slug: 'cinzarra' },
];

const CAPTURED_SAMPLES: CreatureSample[] = [
  { element: 'fire', id: 'fagulha', level: 1, name: 'Fagulha', slot: null, slug: 'fagulha' },
  { element: 'plant', id: 'musguim', level: 2, name: 'Musguim', slot: null, slug: 'musguim' },
  { element: 'neutral', id: 'seixo', level: 1, name: 'Seixo', slot: null, slug: 'seixo' },
];

const SAMPLE_TEAM: TeamView = {
  activeCreatureId: 'brasa',
  addToTeam: noopCommand,
  backpack: [],
  error: null,
  isLoading: false,
  releaseCreature: noopCommand,
  removeFromTeam: noopCommand,
  reorderTeam: noopCommand,
  storage: CAPTURED_SAMPLES.map(buildCreature),
  team: TEAM_SAMPLES.map(buildTeamSlot),
};

export function StorageModalPreview(): ReactElement {
  return <StorageModal contained isOpen onClose={noop} snapshot={SAMPLE_TEAM} />;
}

function buildTeamSlot(sample: CreatureSample): TeamSlot {
  return { creature: buildCreature(sample), slot: sample.slot ?? 0 };
}

function buildCreature(sample: CreatureSample): Creature {
  const isInTeam = sample.slot !== null;
  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    experience: 0,
    id: sample.id,
    isInTeam,
    level: sample.level,
    nickname: null,
    potential: {
      magicAttack: 0,
      magicDefense: 0,
      physicalAttack: 0,
      physicalDefense: 0,
      vitality: 0,
    },
    species: {
      baseMagicAttack: 4,
      baseMagicDefense: 2,
      basePhysicalAttack: 8,
      basePhysicalDefense: 7,
      baseVitality: 22,
      element: sample.element,
      id: sample.id,
      name: sample.name,
      slug: sample.slug,
    },
    speciesId: sample.id,
    teamSlot: sample.slot,
    trainerId: 'trainer-amostra',
  };
}

function noop(): void {
  void 0;
}

function noopCommand(): Promise<void> {
  return Promise.resolve();
}
