import type { Element } from '@creatures/contracts/species';

/**
 * The element of the abilities the game seeds.
 *
 * The `ability_cast` event does not carry the element, only the slug, so the
 * scene resolves the color of the cast from this catalog. It mirrors the
 * seeded abilities and moves into the contracts when the catalog does.
 */
const ABILITY_ELEMENTS: Record<string, Element> = {
  brasa: 'fire',
  espinho: 'plant',
  explosao: 'fire',
  garra: 'neutral',
  ignea: 'fire',
  jato: 'water',
  vendaval: 'water',
};

/**
 * The element of an ability slug, or null when the slug is not known.
 */
export function readAbilityElement(slug: string): Element | null {
  return ABILITY_ELEMENTS[slug] ?? null;
}
