import { expect, test } from 'bun:test';

import {
  DEFAULT_SLOT_COLUMNS,
  computeEmptySlotCount,
  computeSlotColumns,
  resolveSlotColumns,
} from '~/shared/ui/frame/slotGridLayout';

test('a grade sem nenhum item mostra uma linha inteira de slots vazios', checkEmptyGrid);
test('a ultima fileira fecha com slots vazios', checkLastRowCompletion);
test('a fileira cheia nao ganha slots extras', checkFullRow);
test('o numero de colunas segue a largura da grade', checkColumnsByWidth);
test('a grade sem item tem slots antes da medicao da largura', checkFallbackColumns);

function checkEmptyGrid(): void {
  expect(computeEmptySlotCount(11, 0)).toBe(11);
  expect(computeEmptySlotCount(13, 0)).toBe(13);
}

function checkLastRowCompletion(): void {
  expect(computeEmptySlotCount(11, 5)).toBe(6);
  expect(computeEmptySlotCount(11, 15)).toBe(7);
}

function checkFullRow(): void {
  expect(computeEmptySlotCount(11, 11)).toBe(0);
  expect(computeEmptySlotCount(11, 22)).toBe(0);
}

function checkColumnsByWidth(): void {
  expect(computeSlotColumns(656, 56, 4)).toBe(11);
  expect(computeSlotColumns(716, 56, 4)).toBe(12);
  expect(computeSlotColumns(60, 56, 4)).toBe(1);
}

function checkFallbackColumns(): void {
  expect(resolveSlotColumns(0, 0)).toBe(DEFAULT_SLOT_COLUMNS);
  expect(resolveSlotColumns(0, 3)).toBe(0);
  expect(resolveSlotColumns(11, 3)).toBe(11);
}
