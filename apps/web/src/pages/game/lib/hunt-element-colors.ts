const ELEMENT_BACKGROUND_COLORS: Record<string, string> = {
  bug: '#829329',
  dark: '#5e5368',
  dragon: '#6853c9',
  electric: '#c4a929',
  fairy: '#c66a9d',
  fighting: '#b4453f',
  fire: '#d75a2c',
  flying: '#7d8ed1',
  ghost: '#705ca2',
  grass: '#5e9c50',
  ground: '#ad8753',
  ice: '#5aabc0',
  normal: '#7d7b6b',
  poison: '#9a5baa',
  psychic: '#c65785',
  rock: '#97834e',
  steel: '#718799',
  water: '#4e84c7',
};

export function huntElementBackgroundColor(element: string): string {
  return ELEMENT_BACKGROUND_COLORS[element] ?? ELEMENT_BACKGROUND_COLORS.normal;
}
