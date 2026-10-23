/**
 * An item of the catalog of the game that can be equipped in a slot of the
 * trainer.
 *
 * The rank is the strength of the item: the panels show the strongest on top
 * and the weakest at the bottom, so the player sees the line of evolution of
 * the items even without owning the best ones.
 */
export type CatalogItem = {
  description: string;
  itemId: string;
  name: string;
  rank: number;
};

/**
 * The consumables of the catalog, from the weakest to the strongest.
 *
 * The list is the whole catalog, not only what the trainer owns: the panel
 * shows every consumable that exists, and the quantity is what changes the
 * interaction.
 */
export const CONSUMABLE_CATALOG: CatalogItem[] = [
  {
    description: 'Recupera stamina do treinador.',
    itemId: '6a7b8c9d-0e1f-4a2b-9c3d-5e6f7a8b9c0d',
    name: 'Elixir de Stamina',
    rank: 0,
  },
  {
    description: 'Cura o efeito de veneno de uma criatura.',
    itemId: '7b8c9d0e-1f2a-4b3c-8d4e-6f7a8b9c0d1e',
    name: 'Frasco Antídoto',
    rank: 0,
  },
  {
    description: 'Restaura 20 de vida.',
    itemId: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
    name: 'Poção Fraca',
    rank: 1,
  },
  {
    description: 'Restaura a vida de uma criatura.',
    itemId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    name: 'Poção de Cura',
    rank: 2,
  },
  {
    description: 'Restaura mais vida que a poção comum.',
    itemId: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
    name: 'Poção de Cura Forte',
    rank: 3,
  },
];

/**
 * The capture devices of the catalog, from the worst to the best.
 */
export const DEVICE_CATALOG: CatalogItem[] = [
  {
    description: 'Dispositivo de captura mais simples, multiplicador 1x.',
    itemId: '4e5f6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8b',
    name: 'Prisma Simples',
    rank: 1,
  },
  {
    description: 'Dispositivo de captura bruto, de multiplicador máximo.',
    itemId: '5f6a7b8c-9d0e-4f1a-8b2c-4d5e6f7a8b9c',
    name: 'Cristal Bruto',
    rank: 2,
  },
  {
    description: 'Dispositivo de captura de multiplicador alto.',
    itemId: '3d4e5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a',
    name: 'Prisma de Captura',
    rank: 3,
  },
];
