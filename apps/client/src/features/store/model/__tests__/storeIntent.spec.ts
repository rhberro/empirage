import { expect, test } from 'bun:test';

import { createStoreIntent } from '~/features/store/model/storeIntent';

test('a new purchase has a new key', givesANewKeyToEachPurchase);
test('the purchase that is still running keeps its key', keepsTheKeyOfTheRunningPurchase);
test('two purchases at the same time have two keys', givesTwoKeysToTwoPurchases);

function givesANewKeyToEachPurchase(): void {
  const intent = createStoreIntent();
  const first = intent.begin();
  intent.settle('ended');
  const second = intent.begin();
  expect(first).not.toBe(second);
}

function keepsTheKeyOfTheRunningPurchase(): void {
  const intent = createStoreIntent();
  const first = intent.begin();
  intent.settle('in_flight');
  const second = intent.begin();
  expect(second).toBe(first);
}

function givesTwoKeysToTwoPurchases(): void {
  const intent = createStoreIntent();
  const first = intent.begin();
  const second = intent.begin();
  expect(first).not.toBe(second);
}
