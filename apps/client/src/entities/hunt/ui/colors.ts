import type { Element } from '@creatures/contracts/species';

/**
 * The element color, in the hex the Pixi layer draws.
 *
 * The values mirror `element.*` of the theme, kept here because the canvas
 * draws with raw numbers, not theme tokens.
 */
export const ELEMENT_COLOR: Record<Element, number> = {
  fire: 0xdb7448,
  neutral: 0x8090a0,
  plant: 0x9cb45a,
  water: 0x55c9e1,
};

/**
 * The color of an element, falling back to a soft neutral when unknown.
 */
export function elementColor(element: Element | null | undefined): number {
  if (element === null || element === undefined) {
    return 0xf0e6d2;
  }
  return ELEMENT_COLOR[element];
}
