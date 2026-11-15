export type CityCell = { x: number; y: number };

type CityCells = Array<CityCell>;

export type CityPosition = { x: number; y: number };

export type CityInterest = {
  cells: Array<CityCell>;
  center: CityCell;
};

export type CityInterestOptions = {
  cellSize: number;
  mapHeight: number;
  mapWidth: number;
  neighborRadius: number;
};

const DEFAULT_CITY_INTEREST_OPTIONS: CityInterestOptions = {
  cellSize: 16,
  mapHeight: 100,
  mapWidth: 100,
  neighborRadius: 1,
};

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function assertOptions(options: CityInterestOptions): void {
  const { cellSize, mapHeight, mapWidth, neighborRadius } = options;
  if (
    !isPositiveInteger(cellSize) ||
    !isPositiveInteger(mapHeight) ||
    !isPositiveInteger(mapWidth) ||
    !Number.isSafeInteger(neighborRadius) ||
    neighborRadius < 0
  ) {
    throw new RangeError('invalid_city_interest_options');
  }
}

function maximumCell(size: number, cellSize: number): number {
  return Math.ceil(size / cellSize) - 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function cityCellForPosition(
  position: CityPosition,
  options: CityInterestOptions = DEFAULT_CITY_INTEREST_OPTIONS,
): CityCell {
  assertOptions(options);
  const { cellSize, mapHeight, mapWidth } = options;
  const maximumX = maximumCell(mapWidth, cellSize);
  const maximumY = maximumCell(mapHeight, cellSize);
  const x = clamp(Math.floor(position.x / cellSize), 0, maximumX);
  const y = clamp(Math.floor(position.y / cellSize), 0, maximumY);
  return { x, y };
}

export function cityCellKey(cell: CityCell): string {
  return `${cell.x}:${cell.y}`;
}

export function cityInterestForPosition(
  position: CityPosition,
  options: CityInterestOptions = DEFAULT_CITY_INTEREST_OPTIONS,
): CityInterest {
  assertOptions(options);
  const center = cityCellForPosition(position, options);
  const { cellSize, mapHeight, mapWidth, neighborRadius } = options;
  const maximumX = maximumCell(mapWidth, cellSize);
  const maximumY = maximumCell(mapHeight, cellSize);
  const cells: CityCells = [];

  for (let y = center.y - neighborRadius; y <= center.y + neighborRadius; y += 1) {
    if (y < 0 || y > maximumY) {
      continue;
    }
    for (let x = center.x - neighborRadius; x <= center.x + neighborRadius; x += 1) {
      if (x >= 0 && x <= maximumX) {
        const cell = { x, y };
        cells.push(cell);
      }
    }
  }

  return { cells, center };
}
