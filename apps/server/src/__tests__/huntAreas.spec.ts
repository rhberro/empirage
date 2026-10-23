import { expect, test } from 'bun:test';

import type { HuntAreaSpecies } from '@creatures/contracts/hunt';

import { mapHuntAreaItem, mapHuntAreaRow, sortHuntAreasByRecommendedLevel } from '~/db/mappers';
import { areaTone, itemTone, speciesTone } from '~/db/tones';
import type {
  HuntAreaItemRow,
  HuntAreaListEntry,
  HuntAreaRow,
  HuntAreaSpeciesRow,
} from '~/db/types';

import {
  HUNT_AREAS_PATH,
  NOT_FOUND,
  UNAUTHORIZED,
  USER_TOKEN,
  buildHandler,
  buildRequest,
  readError,
  send,
} from './support';

const BRASA: HuntAreaSpeciesRow = {
  is_primary: true,
  position: 0,
  species: {
    element: 'fire',
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    name: 'Brasa',
    slug: 'brasa',
  },
};

const PEDRINO: HuntAreaSpeciesRow = {
  is_primary: false,
  position: 1,
  species: {
    element: 'neutral',
    id: '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e',
    name: 'Pedrino',
    slug: 'pedrino',
  },
};

const AREA_ROW: HuntAreaRow = {
  description: 'Campina coberta de cinzas.',
  hunt_area_species: [PEDRINO, BRASA],
  id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01',
  minimum_level: 1,
  name: 'Campina Cinzenta',
  recommended_level: 3,
  slug: 'campina-cinzenta',
  tone: 'ember',
};

const DROP_ROW: HuntAreaItemRow = {
  items: {
    category: 'material',
    description: 'Pele de uma criatura derrotada.',
    id: '9d0e1f2a-3b4c-4d5e-8f6a-9b0c1d2e3f4a',
    is_store_item: false,
    name: 'Pele de Criatura',
    price: 0,
    slug: 'pele-de-criatura',
  },
  species_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
};

function derivesTheToneOfTheSpecies(): void {
  expect(speciesTone('fire')).toBe('ember');
  expect(speciesTone('water')).toBe('frost');
  expect(speciesTone('plant')).toBe('verdant');
  expect(speciesTone('neutral')).toBe('neutral');
}

function derivesTheToneOfTheItem(): void {
  expect(itemTone('consumable')).toBe('verdant');
  expect(itemTone('device')).toBe('frost');
  expect(itemTone('material')).toBe('gold');
}

function readsTheToneOfTheArea(): void {
  expect(areaTone('blood')).toBe('blood');
  expect(areaTone('arcane')).toBe('arcane');
  expect(areaTone('not-a-tone')).toBe('neutral');
}

function mapsTheArea(): void {
  const area = mapHuntAreaRow(AREA_ROW);
  expect(area.id).toBe(AREA_ROW.id);
  expect(area.slug).toBe('campina-cinzenta');
  expect(area.name).toBe('Campina Cinzenta');
  expect(area.description).toBe('Campina coberta de cinzas.');
  expect(area.minimumLevel).toBe(1);
  expect(area.recommendedLevel).toBe(3);
  expect(area.tone).toBe('ember');
}

function putsThePrimarySpeciesFirst(): void {
  const area = mapHuntAreaRow(AREA_ROW);
  expect(area.species.map(readSpeciesName)).toEqual(['Brasa', 'Pedrino']);
  expect(area.primarySpecies.species.name).toBe('Brasa');
  expect(area.primarySpecies.tone).toBe('ember');
  expect(area.species[1]?.tone).toBe('neutral');
}

function mapsTheItem(): void {
  const item = mapHuntAreaItem(DROP_ROW);
  expect(item?.name).toBe('Pele de Criatura');
  expect(item?.slug).toBe('pele-de-criatura');
  expect(item?.category).toBe('material');
  expect(item?.tone).toBe('gold');
}

function ordersTheAreasByRecommendedLevel(): void {
  const areas = [mapHuntAreaRow(AREA_ROW), mapHuntAreaRow(readSecondAreaRow())];
  const sorted = sortHuntAreasByRecommendedLevel(areas);
  expect(sorted.map(readRecommendedLevel)).toEqual([3, 11]);
  expect(sorted[0]?.slug).toBe('campina-cinzenta');
}

function readSpeciesName(entry: HuntAreaSpecies): string {
  return entry.species.name;
}

function readRecommendedLevel(area: HuntAreaListEntry): number {
  return area.recommendedLevel;
}

function readSecondAreaRow(): HuntAreaRow {
  return {
    ...AREA_ROW,
    id: '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d03',
    name: 'Bosque Urrante',
    recommended_level: 11,
    slug: 'bosque-urrante',
    tone: 'verdant',
  };
}

function huntAreaListRequiresAuth(): Promise<void> {
  const handler = buildHandler();
  const request = buildRequest('GET', HUNT_AREAS_PATH, null);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(UNAUTHORIZED);
    return readError(response).then(assertUnauthenticated);
  });
}

function huntAreaDetailRequiresAuth(): Promise<void> {
  const handler = buildHandler();
  const request = buildRequest('GET', '/api/hunt-areas/not-an-uuid', null);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(UNAUTHORIZED);
    return readError(response).then(assertUnauthenticated);
  });
}

function unknownHuntAreaIsNotFound(): Promise<void> {
  const handler = buildHandler();
  const request = buildRequest('GET', '/api/hunt-areas/not-an-uuid', USER_TOKEN);
  return send(handler, request).then(function assertStatus(response: Response): Promise<void> {
    expect(response.status).toBe(NOT_FOUND);
    return readError(response).then(assertNotFound);
  });
}

function assertUnauthenticated(error: { error: string }): void {
  expect(error.error).toBe('unauthenticated');
}

function assertNotFound(error: { error: string }): void {
  expect(error.error).toBe('trainer_not_found');
}

test('the tone of a species comes from its element', derivesTheToneOfTheSpecies);
test('the tone of an item comes from its category', derivesTheToneOfTheItem);
test('the tone of an area is read from the area', readsTheToneOfTheArea);
test('the area is mapped to the contract', mapsTheArea);
test('the primary species comes first in the area', putsThePrimarySpeciesFirst);
test('the item is mapped with its tone', mapsTheItem);
test('the areas are ordered by the recommended level', ordersTheAreasByRecommendedLevel);
test('GET /api/hunt-areas without bearer returns 401', huntAreaListRequiresAuth);
test('GET /api/hunt-areas/:id without bearer returns 401', huntAreaDetailRequiresAuth);
test('GET /api/hunt-areas/:id with an unknown id returns 404', unknownHuntAreaIsNotFound);
