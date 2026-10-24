/* eslint-disable max-lines -- the clock keeps the samples, the slew and the buffer in one place */
/**
 * How far back the clock looks for the best round trip.
 *
 * A long window keeps a good sample alive across a burst of jitter; a short one
 * follows a real change of route. Ten seconds is the compromise.
 */
const SAMPLE_WINDOW_MS = 10_000;

/**
 * The playback buffer bounds, in milliseconds.
 *
 * The buffer hides the one-way latency plus the jitter: a message sent at `T`
 * must arrive before the renderer reaches `T`. Below 30 ms the buffer stops
 * hiding anything on a local network; above 160 ms the input starts to feel
 * heavy.
 */
const MIN_BUFFER_MS = 30;
const MAX_BUFFER_MS = 160;

/**
 * How much of the worst jitter the buffer keeps in reserve.
 */
const JITTER_WEIGHT = 2;

/**
 * The extra room on top of the latency and the jitter, in milliseconds.
 */
const BUFFER_MARGIN_MS = 20;

/**
 * How fast the jitter estimate follows a new measurement.
 */
const JITTER_SMOOTHING = 0.25;

/**
 * How fast the clock absorbs a change of offset, in milliseconds per second.
 *
 * A pong can move the best offset by a few dozen milliseconds. Applying it in
 * one step would move every actor at once; slewing it changes the speed of the
 * world for a moment instead of teleporting it.
 */
const OFFSET_SLEW_MS_PER_SECOND = 25;

/**
 * How fast the renderer absorbs a change of buffer, in milliseconds per second.
 *
 * The buffer follows the jitter; a small change per second keeps the render
 * smooth while the extra room is being added or removed.
 */
const BUFFER_SLEW_MS_PER_SECOND = 60;

/**
 * One reading of the server clock, with the round trip that produced it.
 */
type ClockSample = {
  offsetMs: number;
  receivedAt: number;
  rttMs: number;
};

type ClockState = {
  appliedBufferMs: number;
  appliedOffsetMs: number;
  initialized: boolean;
  jitterMs: number;
  lastSlewAt: number | null;
  minRttMs: number;
  samples: ClockSample[];
  targetBufferMs: number;
  targetOffsetMs: number;
};

export type ClockPong = {
  /** The moment the client received the answer, on the client clock. */
  receivedAt?: number;
  /** The moment the client sent the ping, on the client clock. */
  sentAt: number;
  /** The moment the server answered, on the server clock. */
  serverNow: number;
};

export type ServerClockOptions = {
  /** The wall clock, injected by the tests. */
  now?: () => number;
};

export type ServerClock = {
  /** The current buffer that separates the render from the server. */
  bufferMs(): number;
  /** The smoothed variation of the round trip. */
  jitterMs(): number;
  /** The estimated server time at this instant. */
  now(): number;
  /** Applies a pong and refines the offset and the buffer. */
  observePong(pong: ClockPong): void;
  /** The server time the renderer should show, behind by the buffer. */
  renderNow(): number;
  /** Forgets every sample: a new connection starts from zero. */
  reset(): void;
  /** The best round trip of the window. */
  rttMs(): number;
  /** The first reading, before any pong. */
  seed(serverNow: number, receivedAt?: number): void;
};

/**
 * The clock of the server as the client estimates it.
 *
 * The offset comes from the lowest round trip of the window, not from the last
 * answer: a single slow packet would otherwise move the whole world. The buffer
 * is derived from the one-way latency and the jitter, so a stable connection
 * renders closer to the server and a noisy one renders further behind.
 */
export function createServerClock(options?: ServerClockOptions): ServerClock {
  const readWallClock = options?.now ?? Date.now;
  const state = createClockState();
  return {
    bufferMs: function bufferMs(): number {
      return state.targetBufferMs;
    },
    jitterMs: function jitterMs(): number {
      return state.jitterMs;
    },
    now: function now(): number {
      const wall = readWallClock();
      advanceSlew(state, wall);
      return wall + state.appliedOffsetMs;
    },
    observePong: function observePong(pong: ClockPong): void {
      applyPong(state, pong, readWallClock);
    },
    renderNow: function renderNow(): number {
      const wall = readWallClock();
      advanceSlew(state, wall);
      return wall + state.appliedOffsetMs - state.appliedBufferMs;
    },
    reset: function reset(): void {
      resetClockState(state);
    },
    rttMs: function rttMs(): number {
      return Number.isFinite(state.minRttMs) ? state.minRttMs : 0;
    },
    seed: function seed(serverNow: number, receivedAt?: number): void {
      seedClock(state, serverNow, receivedAt, readWallClock);
    },
  };
}

/**
 * The clock of the game. It lives outside the stores because both the world and
 * the hunt read it, and the connection is the one that feeds it.
 */
export const serverClock: ServerClock = createServerClock();

function createClockState(): ClockState {
  return {
    appliedBufferMs: MIN_BUFFER_MS,
    appliedOffsetMs: 0,
    initialized: false,
    jitterMs: 0,
    lastSlewAt: null,
    minRttMs: Number.POSITIVE_INFINITY,
    samples: [],
    targetBufferMs: MIN_BUFFER_MS,
    targetOffsetMs: 0,
  };
}

function seedClock(
  state: ClockState,
  serverNow: number,
  receivedAt: number | undefined,
  readWallClock: () => number,
): void {
  // A reading without a round trip is only a starting point: the pongs refine
  // it, and none of them may be replaced by this one.
  if (state.samples.length === 0) {
    state.targetOffsetMs = serverNow - (receivedAt ?? readWallClock());
    state.appliedOffsetMs = state.targetOffsetMs;
  }
}

function applyPong(state: ClockState, pong: ClockPong, readWallClock: () => number): void {
  const receivedAt = pong.receivedAt ?? readWallClock();
  const roundTripMs = Math.max(0, receivedAt - pong.sentAt);
  state.samples.push({
    offsetMs: pong.serverNow + roundTripMs / 2 - receivedAt,
    receivedAt,
    rttMs: roundTripMs,
  });
  state.samples = prune(state.samples, receivedAt);
  state.minRttMs = readMinRtt(state.samples);
  const best = readBestSample(state.samples);
  if (best !== undefined) {
    state.targetOffsetMs = best.offsetMs;
  }
  const deviation = Math.max(0, roundTripMs - state.minRttMs);
  state.jitterMs += (deviation - state.jitterMs) * JITTER_SMOOTHING;
  state.targetBufferMs = clampBuffer(
    Math.ceil(state.minRttMs / 2 + JITTER_WEIGHT * state.jitterMs + BUFFER_MARGIN_MS),
  );
  if (!state.initialized) {
    // The first real sample is the anchor: it places the world once, and every
    // later change is slewed from there.
    state.appliedOffsetMs = state.targetOffsetMs;
    state.appliedBufferMs = state.targetBufferMs;
    state.initialized = true;
    state.lastSlewAt = receivedAt;
  }
}

/**
 * Moves the applied offset and buffer toward their targets at a bounded rate.
 *
 * The timestamps of the simulation are absolute; changing the offset in one
 * step would move the whole world at once. The slew trades a one-frame jump for
 * a small change of speed that nobody perceives.
 */
function advanceSlew(state: ClockState, wall: number): void {
  if (!state.initialized) {
    return;
  }
  if (state.lastSlewAt === null) {
    state.lastSlewAt = wall;
    return;
  }
  const elapsed = wall - state.lastSlewAt;
  if (elapsed <= 0) {
    return;
  }
  state.appliedOffsetMs = moveToward(
    state.appliedOffsetMs,
    state.targetOffsetMs,
    (OFFSET_SLEW_MS_PER_SECOND * elapsed) / 1000,
  );
  state.appliedBufferMs = moveToward(
    state.appliedBufferMs,
    state.targetBufferMs,
    (BUFFER_SLEW_MS_PER_SECOND * elapsed) / 1000,
  );
  state.lastSlewAt = wall;
}

function moveToward(current: number, target: number, maxStep: number): number {
  const difference = target - current;
  if (Math.abs(difference) <= maxStep) {
    return target;
  }
  return current + Math.sign(difference) * maxStep;
}

function resetClockState(state: ClockState): void {
  state.appliedBufferMs = MIN_BUFFER_MS;
  state.appliedOffsetMs = 0;
  state.initialized = false;
  state.jitterMs = 0;
  state.lastSlewAt = null;
  state.minRttMs = Number.POSITIVE_INFINITY;
  state.samples = [];
  state.targetBufferMs = MIN_BUFFER_MS;
  state.targetOffsetMs = 0;
}

function prune(samples: ClockSample[], receivedAt: number): ClockSample[] {
  const oldest = receivedAt - SAMPLE_WINDOW_MS;
  return samples.filter(function isRecent(sample: ClockSample): boolean {
    return sample.receivedAt >= oldest;
  });
}

function readMinRtt(samples: ClockSample[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    if (sample.rttMs < min) {
      min = sample.rttMs;
    }
  }
  return min;
}

/**
 * The sample with the lowest round trip, and the most recent among the ties.
 *
 * The lowest trip is the one least distorted by the queue of the network, so its
 * offset is the closest to the truth.
 */
function readBestSample(samples: ClockSample[]): ClockSample | undefined {
  let best: ClockSample | undefined;
  for (const sample of samples) {
    if (best === undefined || sample.rttMs < best.rttMs) {
      best = sample;
      continue;
    }
    if (sample.rttMs === best.rttMs && sample.receivedAt > best.receivedAt) {
      best = sample;
    }
  }
  return best;
}

function clampBuffer(value: number): number {
  if (value < MIN_BUFFER_MS) {
    return MIN_BUFFER_MS;
  }
  if (value > MAX_BUFFER_MS) {
    return MAX_BUFFER_MS;
  }
  return value;
}
