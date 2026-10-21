import { randomBytes } from 'node:crypto';

/**
 * The deterministic random state of a hunt.
 *
 * The random state lives inside the state of the hunt -- a seed and the number
 * of draws -- and not in a singleton of this module. The reason is the catch-up
 * of an offline hunt: the simulation is resumed later, in another process, and
 * it has to produce exactly the same draws it would have produced had it run
 * in real time. A generator kept in memory would draw again, and the player
 * would receive loot that is not the loot they earned before closing the tab.
 *
 * The generator is counter based: the value of a draw is a function of the
 * seed and of the number of the draw, and never of a previous value. That is
 * what makes the state small enough to be a pair of numbers and what makes the
 * resume trivial: the counter is the cursor of the generator.
 */

/** Two to the sixty four, the size of the space of the mixer. */
const MODULUS = 18446744073709551616n;

/** The golden ratio constant, used to spread the seed over the whole space. */
const GOLDEN_GAMMA = 0x9e3779b97f4a7c15n;

/** The first multiplier of the mix. */
const MIX_A = 0xbf58476d1ce4e5b9n;

/** The second multiplier of the mix. */
const MIX_B = 0x94d049bb133111ebn;

/** The third multiplier of the mix. */
const MIX_C = 0x2545f4914f6cdd1dn;

/** The divisor that leaves the high bits of a mixed value. */
const SCALE = 2048n;

/** The size of the space of the mantissa of a double, used to scale a draw. */
const MANTISSA_RANGE = 2 ** 53;

/** The number of bytes of a seed. Six bytes keep the seed an exact number. */
const SEED_BYTES = 6;

/**
 * The random state of a hunt.
 *
 * The seed is the seed of the generator and the draws say how many numbers
 * were already taken from it. Both travel with the session.
 */
export type HuntRandomState = {
  /** How many numbers were already drawn. */
  draws: number;
  /** The seed of the generator. */
  seed: number;
};

/**
 * A draw of the generator, with the state that follows it.
 */
export type HuntRandomDraw<T> = {
  /** The state after the draw. */
  state: HuntRandomState;
  /** The value that was drawn. */
  value: T;
};

/**
 * An entry of a weighted list.
 */
export type WeightedEntry<T> = {
  /** The weight of the entry. It is never negative. */
  weight: number;
  /** The value of the entry. */
  value: T;
};

/**
 * A seed for a new hunt.
 *
 * This is the only place where the hunt draws something that is not
 * reproducible, and it happens once, when the hunt begins. The seed is written
 * in the session, and everything the hunt draws from then on is a function of
 * it.
 */
export function createHuntSeed(): number {
  const bytes = randomBytes(SEED_BYTES);
  let seed = 0n;
  for (const byte of bytes) {
    seed = seed * 256n + BigInt(byte);
  }
  return Number(seed);
}

/**
 * A number between zero and one, taken from the generator.
 */
export function drawUnit(state: HuntRandomState): HuntRandomDraw<number> {
  const counter = BigInt(state.draws) + 1n;
  const mixed = mix64(BigInt(state.seed) * GOLDEN_GAMMA + counter * MIX_A);
  const mantissa = Number(mixed / SCALE);
  return {
    state: { draws: state.draws + 1, seed: state.seed },
    value: mantissa / MANTISSA_RANGE,
  };
}

/**
 * An integer between zero and the given limit, taken from the generator.
 */
export function drawInt(state: HuntRandomState, limit: number): HuntRandomDraw<number> {
  const draw = drawUnit(state);
  const bound = Math.max(0, Math.floor(limit));
  return { state: draw.state, value: Math.floor(draw.value * bound) };
}

/**
 * An element of a weighted list, taken from the generator.
 *
 * The result is null when the list is empty or when every weight is zero: there
 * is nothing to draw from, and the caller decides what that means.
 */
export function drawWeighted<T>(
  state: HuntRandomState,
  entries: WeightedEntry<T>[],
): HuntRandomDraw<T | null> {
  const total = entries.reduce(function sumWeights(sum: number, entry: WeightedEntry<T>): number {
    return sum + Math.max(0, entry.weight);
  }, 0);
  if (entries.length === 0 || total <= 0) {
    return { state, value: null };
  }
  const draw = drawUnit(state);
  let cursor = draw.value * total;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.weight);
    if (cursor < 0) {
      return { state: draw.state, value: entry.value };
    }
  }
  return { state: draw.state, value: entries.at(-1)?.value ?? null };
}

/**
 * The mix of a value.
 *
 * The mixer is a sequence of multiplications and additions modulo two to the
 * sixty four. The multiplications spread a small difference of the input over
 * the whole space, and the mantissa of the result is taken from the high bits,
 * which depend on every bit of the input.
 */
function mix64(value: bigint): bigint {
  let mixed = (value + GOLDEN_GAMMA) % MODULUS;
  mixed = (mixed * MIX_A) % MODULUS;
  mixed = (mixed + MIX_B) % MODULUS;
  mixed = (mixed * MIX_C) % MODULUS;
  return (mixed + GOLDEN_GAMMA) % MODULUS;
}
