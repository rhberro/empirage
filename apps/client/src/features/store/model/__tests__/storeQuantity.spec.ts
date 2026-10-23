import { expect, test } from 'bun:test';

import type { StoreBagItem, StoreItem } from '@creatures/contracts/store';

import {
  clampQuantity,
  computeQuantityLimit,
  MAX_STORE_QUANTITY,
  normalizeQuantity,
  readQuantity,
} from '~/features/store/model/storeQuantity';

const CATALOG: StoreItem[] = [
  {
    category: 'consumable',
    description: 'Restaura a vida de uma criatura.',
    id: 'pocao',
    name: 'Poção de Cura',
    price: 120,
    slug: 'pocao-de-cura',
  },
];

const BAG: StoreBagItem[] = [
  {
    category: 'consumable',
    description: 'Restaura a vida de uma criatura.',
    itemId: 'pocao',
    name: 'Poção de Cura',
    quantity: 12,
    sellPrice: 108,
    slug: 'pocao-de-cura',
  },
];

function keepsTheQuantityInsideTheLimit(): void {
  expect(clampQuantity(0)).toBe(1);
  expect(clampQuantity(-5)).toBe(1);
  expect(clampQuantity(1)).toBe(1);
  expect(clampQuantity(999999)).toBe(999999);
  expect(clampQuantity(1000000)).toBe(MAX_STORE_QUANTITY);
}

function takesTheQuantityBackToOneWhenTheFieldIsEmpty(): void {
  expect(normalizeQuantity('')).toBe(1);
  expect(normalizeQuantity('abc')).toBe(1);
  expect(normalizeQuantity('-3')).toBe(1);
  expect(normalizeQuantity('0')).toBe(1);
}

function keepsTheQuantityThePlayerTyped(): void {
  expect(normalizeQuantity('42')).toBe(42);
  expect(normalizeQuantity('12')).toBe(12);
  expect(normalizeQuantity('1000000')).toBe(MAX_STORE_QUANTITY);
}

function readsTheQuantityWhileThePlayerWrites(): void {
  expect(readQuantity('7')).toBe(7);
  expect(readQuantity('0')).toBe(1);
  expect(readQuantity('')).toBe(1);
}

function theQuantityNeverPassesTheLimit(): void {
  expect(clampQuantity(50, 10)).toBe(10);
  expect(clampQuantity(5, 10)).toBe(5);
  expect(clampQuantity(5, 0)).toBe(0);
  expect(readQuantity('50', 10)).toBe(10);
  expect(normalizeQuantity('50', 10)).toBe(10);
}

function theBuyIsLimitedByTheGold(): void {
  expect(computeQuantityLimit('buy', CATALOG, BAG, 'pocao', null, 1000)).toBe(8);
  expect(computeQuantityLimit('buy', CATALOG, BAG, 'pocao', null, 119)).toBe(1);
  expect(computeQuantityLimit('buy', CATALOG, BAG, null, null, 1000)).toBe(0);
}

function theSaleIsLimitedByTheBackpack(): void {
  expect(computeQuantityLimit('sell', CATALOG, BAG, null, 'pocao', 1000)).toBe(12);
  expect(computeQuantityLimit('sell', CATALOG, BAG, null, null, 1000)).toBe(0);
}

test('the quantity never leaves the limit', keepsTheQuantityInsideTheLimit);
test('the empty field goes back to one', takesTheQuantityBackToOneWhenTheFieldIsEmpty);
test('the quantity the player typed is kept', keepsTheQuantityThePlayerTyped);
test('the quantity follows the text of the field', readsTheQuantityWhileThePlayerWrites);
test('the quantity never passes the limit of the action', theQuantityNeverPassesTheLimit);
test('the buy is limited by the gold of the player', theBuyIsLimitedByTheGold);
test('the sale is limited by the backpack of the player', theSaleIsLimitedByTheBackpack);
