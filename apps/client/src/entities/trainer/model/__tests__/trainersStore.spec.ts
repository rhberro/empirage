import { expect, test } from 'bun:test';

import {
  createTrainersStore,
  selectIsLoaded,
  selectSelectedTrainerId,
} from '~/entities/trainer/model/trainersStore';

function theStoreStartsEmpty(): void {
  const store = createTrainersStore();
  expect(selectIsLoaded(store.getState())).toBe(false);
  expect(selectSelectedTrainerId(store.getState())).toBeNull();
}

function theChosenTrainerIsRemembered(): void {
  const store = createTrainersStore();
  store.getState().select('trainer-1');
  expect(selectSelectedTrainerId(store.getState())).toBe('trainer-1');
}

function theListThatArrivedIsRemembered(): void {
  const store = createTrainersStore();
  store.getState().markLoaded();
  expect(selectIsLoaded(store.getState())).toBe(true);
}

function theEndOfTheSessionTakesEverythingAway(): void {
  const store = createTrainersStore();
  store.getState().markLoaded();
  store.getState().select('trainer-1');
  store.getState().reset();
  expect(selectIsLoaded(store.getState())).toBe(false);
  expect(selectSelectedTrainerId(store.getState())).toBeNull();
}

test('the store starts empty', theStoreStartsEmpty);
test('the chosen trainer is remembered', theChosenTrainerIsRemembered);
test('the list that arrived is remembered', theListThatArrivedIsRemembered);
test('the end of the session takes everything away', theEndOfTheSessionTakesEverythingAway);
