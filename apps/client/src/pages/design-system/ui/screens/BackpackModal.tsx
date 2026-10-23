import type { InventoryItem } from '@creatures/contracts/inventory';
import type { ReactElement } from 'react';

import type { TeamView } from '~/entities/team';
import { BackpackModal } from '~/features/backpack';

const SAMPLE_ITEMS: InventoryItem[] = [
  {
    category: 'consumable',
    description: 'Restaura a vida da criatura.',
    isStoreItem: true,
    itemId: 'item-pocao',
    name: 'Poção de Cura',
    price: 120,
    quantity: 3,
    slug: 'pocao-de-cura',
  },
  {
    category: 'device',
    description: 'Prisma de captura.',
    isStoreItem: true,
    itemId: 'item-prisma',
    name: 'Prisma Menor',
    price: 900,
    quantity: 2,
    slug: 'prisma-menor',
  },
  {
    category: 'material',
    description: 'Resto de criatura.',
    isStoreItem: false,
    itemId: 'item-resto',
    name: 'Resto de Brasa',
    price: 0,
    quantity: 5,
    slug: 'resto-de-brasa',
  },
  {
    category: 'material',
    description: 'Pedra do caminho.',
    isStoreItem: false,
    itemId: 'item-pedra',
    name: 'Pedra',
    price: 0,
    quantity: 12,
    slug: 'pedra',
  },
];

const SAMPLE_TEAM: TeamView = {
  activeCreatureId: null,
  addToTeam: noopCommand,
  backpack: SAMPLE_ITEMS,
  error: null,
  isLoading: false,
  releaseCreature: noopCommand,
  removeFromTeam: noopCommand,
  reorderTeam: noopCommand,
  storage: [],
  team: [],
};

export function BackpackModalPreview(): ReactElement {
  return <BackpackModal contained isOpen onClose={noop} snapshot={SAMPLE_TEAM} />;
}

function noop(): void {
  void 0;
}

function noopCommand(): Promise<void> {
  return Promise.resolve();
}
