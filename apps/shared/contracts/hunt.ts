import type { SpeciesSummary } from './creature';
import type { ItemCategory } from './inventory';

/**
 * The tone of a hunt area, a creature or an item.
 *
 * It is a name, never a color. The interface resolves a tone to the semantic
 * palette tokens it needs, so a tone that comes from the database never turns
 * into a raw color on the screen.
 */
export type HuntAreaTone = 'arcane' | 'blood' | 'ember' | 'frost' | 'gold' | 'neutral' | 'verdant';

/**
 * A species of an area, with the tone it is drawn with.
 */
export type HuntAreaSpecies = {
  species: SpeciesSummary;
  tone: HuntAreaTone;
};

/**
 * An item that can be obtained in an area, with the tone it is drawn with.
 */
export type HuntAreaItem = {
  category: ItemCategory;
  description: string;
  itemId: string;
  /** Whether the store of the NPC sells the item. */
  isStoreItem: boolean;
  name: string;
  /** The price of the item in the store of the NPC. */
  price: number;
  slug: string;
  tone: HuntAreaTone;
};

/**
 * A hunt area, as the selection modal shows it.
 *
 * The order of the areas is decided by the server, from the lowest
 * recommended level to the highest.
 */
export type HuntArea = {
  description: string;
  id: string;
  minimumLevel: number;
  name: string;
  recommendedLevel: number;
  slug: string;
  /** The species that represents the area, the one drawn large in the card. */
  primarySpecies: HuntAreaSpecies;
  /** Every species of the area, in the order the server decides. */
  species: HuntAreaSpecies[];
  tone: HuntAreaTone;
};

/**
 * A hunt area, as the details drawer shows it.
 *
 * The drawer shows every creature of the area and every item that can be
 * obtained there, with no cut.
 */
export type HuntAreaDetail = HuntArea & {
  items: HuntAreaItem[];
};
