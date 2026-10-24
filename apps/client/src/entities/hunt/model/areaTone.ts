/**
 * The tint of an area, applied as a subtle overlay over the ground.
 *
 * The tone is a reading of the area, not data the server sends: the color
 * comes from the element palette of the theme, so a hunt area and its gallery
 * card read as the same place.
 */
export type AreaTone = {
  alpha: number;
  color: number;
};

const NEUTRAL_TONE: AreaTone = { alpha: 0.04, color: 0x8090a0 };

const AREA_TONES: Record<string, AreaTone> = {
  'bosque-urrante': { alpha: 0.06, color: 0x9cb45a },
  'campina-cinzenta': { alpha: 0.07, color: 0xe89a70 },
  'lago-congelado': { alpha: 0.07, color: 0x55c9e1 },
  'ruinas-de-pedra': NEUTRAL_TONE,
};

/**
 * The tone of a hunt area, falling back to a neutral wash for unknown slugs.
 */
export function readAreaTone(slug: string): AreaTone {
  return AREA_TONES[slug] ?? NEUTRAL_TONE;
}
