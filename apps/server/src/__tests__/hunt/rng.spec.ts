import { expect, test } from 'bun:test';

import { createHuntSeed, drawInt, drawUnit, drawWeighted } from '~/hunt/rng';
import type { HuntRandomState, WeightedEntry } from '~/hunt/rng';

const SEED = 1234567890123;

function buildState(): HuntRandomState {
  return { draws: 0, seed: SEED };
}

function drawsTenTimes(state: HuntRandomState): number[] {
  const values: number[] = [];
  let cursor = state;
  for (let index = 0; index < 10; index += 1) {
    const draw = drawUnit(cursor);
    cursor = draw.state;
    values.push(draw.value);
  }
  return values;
}

function sameSequenceIsDrawnTwice(): void {
  const first = drawsTenTimes(buildState());
  const second = drawsTenTimes(buildState());
  expect(first).toEqual(second);
}

function theDrawsAreInsideTheUnitInterval(): void {
  for (const value of drawsTenTimes(buildState())) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
}

function differentSeedsGiveDifferentSequences(): void {
  const first = drawsTenTimes({ draws: 0, seed: SEED });
  const second = drawsTenTimes({ draws: 0, seed: SEED + 1 });
  expect(first).not.toEqual(second);
}

function theCounterAdvances(): void {
  const draw = drawUnit(buildState());
  expect(draw.state.draws).toBe(1);
  expect(draw.state.seed).toBe(SEED);
}

function theCounterContinuesWhereItStopped(): void {
  const stopped = drawUnit(buildState());
  const resumed = drawUnit(stopped.state);
  const straight = drawsTenTimes(buildState());
  expect(resumed.value).toBe(straight[1]);
}

function theDrawsOfDifferentCountersDiffer(): void {
  const first = drawUnit(buildState());
  const second = drawUnit({ draws: 1, seed: SEED });
  expect(first.value).not.toBe(second.value);
}

function theIntegerStaysInsideTheLimit(): void {
  let cursor = buildState();
  for (let index = 0; index < 50; index += 1) {
    const draw = drawInt(cursor, 6);
    cursor = draw.state;
    expect(draw.value).toBeGreaterThanOrEqual(0);
    expect(draw.value).toBeLessThan(6);
  }
}

function theWeightedChoiceFavorsTheHeavyEntry(): void {
  const entries: WeightedEntry<string>[] = [
    { value: 'rare', weight: 1 },
    { value: 'common', weight: 99 },
  ];
  let cursor = buildState();
  let commons = 0;
  for (let index = 0; index < 200; index += 1) {
    const draw = drawWeighted(cursor, entries);
    cursor = draw.state;
    if (draw.value === 'common') {
      commons += 1;
    }
  }
  expect(commons).toBeGreaterThan(100);
}

function theWeightedChoiceIsReproducible(): void {
  const entries: WeightedEntry<string>[] = [
    { value: 'rare', weight: 1 },
    { value: 'common', weight: 99 },
  ];
  const first = drawWeighted(buildState(), entries);
  const second = drawWeighted(buildState(), entries);
  expect(first.value).toBe(second.value);
  expect(first.state.draws).toBe(second.state.draws);
}

function theWeightedChoiceOfAnEmptyListIsNull(): void {
  const draw = drawWeighted(buildState(), []);
  expect(draw.value).toBeNull();
  expect(draw.state.draws).toBe(0);
}

function theSeedIsInsideTheSafeRange(): void {
  const seed = createHuntSeed();
  expect(Number.isSafeInteger(seed)).toBe(true);
  expect(seed).toBeGreaterThanOrEqual(0);
}

test('the same seed gives the same sequence', sameSequenceIsDrawnTwice);
test('the draws are inside the unit interval', theDrawsAreInsideTheUnitInterval);
test('different seeds give different sequences', differentSeedsGiveDifferentSequences);
test('the counter of draws advances', theCounterAdvances);
test('the counter resumes where it stopped', theCounterContinuesWhereItStopped);
test('the draws of different counters differ', theDrawsOfDifferentCountersDiffer);
test('the integer stays inside the limit', theIntegerStaysInsideTheLimit);
test('the weighted choice favors the heavy entry', theWeightedChoiceFavorsTheHeavyEntry);
test('the weighted choice is reproducible', theWeightedChoiceIsReproducible);
test('the weighted choice of an empty list is null', theWeightedChoiceOfAnEmptyListIsNull);
test('the seed is inside the safe range', theSeedIsInsideTheSafeRange);
