import type {
  HuntArea,
  HuntAreaDetail,
  HuntAreaItem,
  HuntAreaSpecies,
  HuntAreaTone,
} from '@creatures/contracts/hunt';
import type { ItemCategory } from '@creatures/contracts/inventory';
import type { Element } from '@creatures/contracts/species';

type SpeciesSeed = {
  element: Element;
  id: string;
  name: string;
  tone: HuntAreaTone;
};

type ItemSeed = {
  category: ItemCategory;
  id: string;
  name: string;
  tone: HuntAreaTone;
};

type AreaSeed = {
  description: string;
  id: string;
  items: ItemSeed[];
  minimumLevel: number;
  name: string;
  recommendedLevel: number;
  slug: string;
  species: SpeciesSeed[];
  tone: HuntAreaTone;
};

function creature(element: Element, id: string, name: string, tone: HuntAreaTone): SpeciesSeed {
  return { element, id, name, tone };
}

function material(id: string, name: string): ItemSeed {
  return { category: 'material', id, name, tone: 'gold' };
}

function consumable(id: string, name: string): ItemSeed {
  return { category: 'consumable', id, name, tone: 'verdant' };
}

function device(id: string, name: string): ItemSeed {
  return { category: 'device', id, name, tone: 'frost' };
}

const BRASA = creature('fire', 'brasa', 'Brasa', 'ember');
const GOTA = creature('water', 'gota', 'Gota', 'frost');
const BROTO = creature('plant', 'broto', 'Broto', 'verdant');
const CINZARRA = creature('fire', 'cinzarra', 'Cinzarra', 'ember');
const PEDRINO = creature('neutral', 'pedrino', 'Pedrino', 'neutral');

const PECA = material('pata-de-criatura', 'Pata de Criatura');
const PELE = material('pele-de-criatura', 'Pele de Criatura');
const ASA = material('asa-de-criatura', 'Asa de Criatura');
const COURO = material('couro-de-criatura', 'Couro de Criatura');
const CINZA = material('cinza-de-criatura', 'Cinza de Criatura');
const SEIVA = material('seiva-de-criatura', 'Seiva de Criatura');
const POCAO = consumable('pocao-de-cura', 'Poção de Cura');
const PRISMA = device('prisma-de-captura', 'Prisma de Captura');

const AREA_SEEDS: AreaSeed[] = [
  {
    description: 'Campina coberta de cinzas onde criaturas de brasa passeiam entre tufos secos.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01',
    items: [ASA, PECA, PELE, CINZA, COURO, SEIVA],
    minimumLevel: 1,
    name: 'Campina Cinzenta',
    recommendedLevel: 3,
    slug: 'campina-cinzenta',
    species: [BRASA, CINZARRA, PEDRINO, BROTO],
    tone: 'ember',
  },
  {
    description: 'Lago de gelo espesso, onde o vento carrega cristais e a caçada é lenta.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d02',
    items: [ASA, PECA, PELE, COURO],
    minimumLevel: 5,
    name: 'Lago Congelado',
    recommendedLevel: 7,
    slug: 'lago-congelado',
    species: [GOTA, PEDRINO, BRASA],
    tone: 'frost',
  },
  {
    description: 'Bosque de plantas falantes, cujas folhas sussurram o nome de quem caça.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d03',
    items: [ASA, PECA, PELE, COURO, SEIVA],
    minimumLevel: 9,
    name: 'Bosque Urrante',
    recommendedLevel: 11,
    slug: 'bosque-urrante',
    species: [BROTO, GOTA, PEDRINO, BRASA],
    tone: 'verdant',
  },
  {
    description: 'Ruínas de pedra antiga, onde a vida se instalou entre os blocos caídos.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d04',
    items: [ASA, PECA, PELE, COURO, CINZA],
    minimumLevel: 14,
    name: 'Ruínas de Pedra',
    recommendedLevel: 15,
    slug: 'ruinas-de-pedra',
    species: [PEDRINO, CINZARRA, GOTA, BRASA],
    tone: 'neutral',
  },
  {
    description: 'Vento de cinzas e couro queimado, onde o que corre não volta inteiro.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d05',
    items: [ASA, PECA, PELE, COURO, CINZA],
    minimumLevel: 18,
    name: 'Rajada Morta',
    recommendedLevel: 20,
    slug: 'rajada-morta',
    species: [CINZARRA, BRASA, PEDRINO],
    tone: 'blood',
  },
  {
    description: 'Vale de névoa baixa, onde as criaturas sussurram o nome de quem as ouve.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d06',
    items: [ASA, PECA, PELE, COURO, SEIVA, POCAO],
    minimumLevel: 23,
    name: 'Vale do Sussurro',
    recommendedLevel: 25,
    slug: 'vale-do-sussurro',
    species: [
      creature('water', 'orvalho', 'Orvalho', 'arcane'),
      creature('water', 'vagalume', 'Vagalume', 'frost'),
      creature('plant', 'sussurro', 'Sussurro', 'verdant'),
      creature('neutral', 'sombra', 'Sombra', 'neutral'),
      creature('fire', 'eco', 'Eco', 'arcane'),
      creature('water', 'bruma', 'Bruma', 'neutral'),
    ],
    tone: 'arcane',
  },
  {
    description: 'Eclusa de ferro enferrujado, onde o metal range antes de o sol aquecer.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d07',
    items: [ASA, PECA, PELE, COURO, PRISMA],
    minimumLevel: 28,
    name: 'Eclusa de Ferro',
    recommendedLevel: 30,
    slug: 'eclusa-de-ferro',
    species: [
      creature('neutral', 'cinzeiro', 'Cinzeiro', 'neutral'),
      creature('fire', 'ferrugem', 'Ferrugem', 'blood'),
      creature('neutral', 'torrao', 'Torrão', 'gold'),
    ],
    tone: 'gold',
  },
  {
    description: 'Cripta silenciosa, onde os mortos guardam o que deixaram de usar.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d08',
    items: [ASA, PECA, PELE, COURO, CINZA, PRISMA],
    minimumLevel: 34,
    name: 'Cripta Silente',
    recommendedLevel: 36,
    slug: 'cripta-silente',
    species: [
      creature('fire', 'vigilia', 'Vigília', 'arcane'),
      creature('fire', 'ceifa', 'Ceifa', 'blood'),
      creature('water', 'mimico', 'Mímico', 'frost'),
      creature('neutral', 'veu', 'Véu', 'neutral'),
    ],
    tone: 'arcane',
  },
  {
    description: 'Gruta de sal branco, onde o chão range como casca de casca.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d09',
    items: [ASA, PECA, PELE, CINZA],
    minimumLevel: 40,
    name: 'Gruta de Sal',
    recommendedLevel: 42,
    slug: 'gruta-de-sal',
    species: [
      creature('neutral', 'pedrinha', 'Pedrinha', 'neutral'),
      creature('neutral', 'golem', 'Golem', 'gold'),
      creature('fire', 'areia-viva', 'Areia Viva', 'ember'),
    ],
    tone: 'neutral',
  },
  {
    description: 'Pântano sem luz, onde cada passo acorda o que dorme na lama.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d10',
    items: [ASA, PECA, PELE, SEIVA, POCAO],
    minimumLevel: 46,
    name: 'Pântano Cego',
    recommendedLevel: 48,
    slug: 'pantano-cego',
    species: [
      creature('plant', 'brotinho', 'Brotinho', 'verdant'),
      creature('plant', 'espinho', 'Espinho', 'verdant'),
      creature('plant', 'raiz-forte', 'Raiz-Forte', 'gold'),
      creature('water', 'mariposa', 'Mariposa', 'arcane'),
      creature('plant', 'lagarta', 'Lagarta', 'neutral'),
    ],
    tone: 'verdant',
  },
  {
    description: 'Torre partida ao meio, com vento que desce do alto em rajadas.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d11',
    items: [ASA, PECA, PELE, COURO, PRISMA],
    minimumLevel: 52,
    name: 'Torre Partida',
    recommendedLevel: 54,
    slug: 'torre-partida',
    species: [
      creature('water', 'voador', 'Voador', 'frost'),
      creature('water', 'pinguim', 'Pinguim', 'frost'),
      creature('water', 'gelo-fino', 'Gelo-Fino', 'arcane'),
      creature('neutral', 'nevora', 'Névora', 'neutral'),
    ],
    tone: 'frost',
  },
  {
    description: 'Praia de cinzas quentes, onde a maré nunca chega de verdade.',
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d12',
    items: [ASA, PECA, PELE, CINZA, COURO, POCAO],
    minimumLevel: 58,
    name: 'Praia de Cinzas',
    recommendedLevel: 60,
    slug: 'praia-de-cinzas',
    species: [
      creature('fire', 'fagulha', 'Fagulha', 'ember'),
      creature('neutral', 'cinzas', 'Cinzas', 'neutral'),
      creature('fire', 'brasa-viva', 'Brasa Viva', 'ember'),
      creature('fire', 'escama', 'Escama', 'blood'),
      creature('plant', 'musguinho', 'Musguinho', 'verdant'),
      creature('neutral', 'pipoca', 'Pipoca', 'gold'),
      creature('plant', 'casulo', 'Casulo', 'verdant'),
      creature('neutral', 'casca', 'Casca', 'gold'),
      creature('water', 'ressaca', 'Ressaca', 'frost'),
    ],
    tone: 'ember',
  },
];

export const SAMPLE_HUNT_AREAS: HuntArea[] = AREA_SEEDS.map(buildArea);

export const SAMPLE_HUNT_AREA_DETAIL: HuntAreaDetail = {
  ...buildArea(AREA_SEEDS[1]),
  items: buildItems(AREA_SEEDS[1]),
};

function buildArea(seed: AreaSeed): HuntArea {
  return {
    description: seed.description,
    id: seed.id,
    minimumLevel: seed.minimumLevel,
    name: seed.name,
    // The server puts the primary species first, so the first one of the seed
    // is the one the card draws large.
    primarySpecies: buildSpecies(seed.species[0]),
    recommendedLevel: seed.recommendedLevel,
    slug: seed.slug,
    species: seed.species.map(buildSpecies),
    tone: seed.tone,
  };
}

function buildSpecies(seed: SpeciesSeed): HuntAreaSpecies {
  return {
    species: { element: seed.element, id: seed.id, name: seed.name, slug: seed.id },
    tone: seed.tone,
  };
}

function buildItems(seed: AreaSeed): HuntAreaItem[] {
  return seed.items.map(buildItem);
}

function buildItem(seed: ItemSeed): HuntAreaItem {
  return {
    category: seed.category,
    description: '',
    isStoreItem: false,
    itemId: seed.id,
    name: seed.name,
    price: 0,
    slug: seed.id,
    tone: seed.tone,
  };
}
