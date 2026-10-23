import type { HuntAreaItem, HuntAreaSpecies, HuntAreaTone } from '@creatures/contracts/hunt';

/**
 * A creature or an item of an area, reduced to what the interface draws: the
 * name that the tooltip shows and the tone that colors the circle.
 */
export type HuntAreaEntry = {
  /** The description of the item, quando a entrada e um item. */
  description: string;
  /** Whether the store of the NPC sells the item. */
  isStoreItem: boolean;
  name: string;
  /** The price of the item in the store of the NPC. */
  price: number;
  tone: HuntAreaTone;
};

export function huntAreaSpeciesEntries(species: HuntAreaSpecies[]): HuntAreaEntry[] {
  return species.map(toSpeciesEntry);
}

export function huntAreaItemEntries(items: HuntAreaItem[]): HuntAreaEntry[] {
  return items.map(toItemEntry);
}

function toSpeciesEntry(entry: HuntAreaSpecies): HuntAreaEntry {
  return {
    description: '',
    isStoreItem: false,
    name: entry.species.name,
    price: 0,
    tone: entry.tone,
  };
}

function toItemEntry(entry: HuntAreaItem): HuntAreaEntry {
  return {
    description: entry.description,
    isStoreItem: entry.isStoreItem,
    name: entry.name,
    price: entry.price,
    tone: entry.tone,
  };
}
