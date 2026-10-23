import type { StoreCatalog } from '@creatures/contracts/store';

/**
 * The catalog of samples, for the gallery of the design system.
 *
 * The store of the game is real: it reads the catalog of the server. The
 * gallery shows the modal outside the game, and there is no server there.
 */
export const SAMPLE_STORE_CATALOG: StoreCatalog = {
  bag: [
    {
      category: 'consumable',
      description: 'Restaura a vida de uma criatura.',
      itemId: 'sample-pocao',
      name: 'Poção de Cura',
      quantity: 12,
      sellPrice: 108,
      slug: 'pocao-de-cura',
    },
    {
      category: 'device',
      description: 'Dispositivo de captura de multiplicador alto.',
      itemId: 'sample-prisma',
      name: 'Prisma de Captura',
      quantity: 3,
      sellPrice: 1620,
      slug: 'prisma-de-captura',
    },
  ],
  gold: 2480,
  items: [
    {
      category: 'consumable',
      description: 'Restaura a vida de uma criatura.',
      id: 'sample-pocao',
      name: 'Poção de Cura',
      price: 120,
      slug: 'pocao-de-cura',
    },
    {
      category: 'consumable',
      description: 'Restaura mais vida que a poção comum.',
      id: 'sample-pocao-forte',
      name: 'Poção de Cura Forte',
      price: 320,
      slug: 'pocao-de-cura-forte',
    },
    {
      category: 'consumable',
      description: 'Restaura 20 de vida.',
      id: 'sample-pocao-fraca',
      name: 'Poção Fraca',
      price: 60,
      slug: 'pocao-fraca',
    },
    {
      category: 'device',
      description: 'Dispositivo de captura de multiplicador alto.',
      id: 'sample-prisma',
      name: 'Prisma de Captura',
      price: 1800,
      slug: 'prisma-de-captura',
    },
    {
      category: 'device',
      description: 'Dispositivo de captura bruto, de multiplicador máximo.',
      id: 'sample-cristal',
      name: 'Cristal Bruto',
      price: 2400,
      slug: 'cristal-bruto',
    },
    {
      category: 'device',
      description: 'Dispositivo de captura mais simples, multiplicador 1x.',
      id: 'sample-prisma-simples',
      name: 'Prisma Simples',
      price: 900,
      slug: 'prisma-simples',
    },
  ],
};
