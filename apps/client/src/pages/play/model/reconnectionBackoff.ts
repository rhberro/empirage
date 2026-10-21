/**
 * The wait between two attempts of opening the channel.
 *
 * The wait grows with the number of failed attempts and never passes the
 * ceiling: a server that is down for hours does not have to be asked a
 * thousand times, and the player that comes back finds the channel open
 * without waiting for a long time.
 */
export type BackoffOptions = {
  /** The wait of the first attempt. */
  baseMs?: number;
  /** How much the wait grows with each attempt. */
  factor?: number;
  /** The jitter of the wait, as a fraction of it. */
  jitterRatio?: number;
  /** The biggest wait the client accepts. */
  maxMs?: number;
  /** The source of the randomness of the jitter. */
  random?: () => number;
};

/**
 * The default of the backoff: a second at the first, double every time, and
 * never more than half a minute.
 */
export const DEFAULT_BACKOFF = {
  baseMs: 1000,
  factor: 2,
  jitterRatio: 0.2,
  maxMs: 30000,
};

/**
 * The wait before the attempt that follows the failed one.
 *
 * The jitter is there so that a server that comes back does not receive a
 * crowd of clients at the same instant: two players who lost the connection
 * in the same second do not come back in the same millisecond.
 */
export function computeBackoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const baseMs = options.baseMs ?? DEFAULT_BACKOFF.baseMs;
  const factor = options.factor ?? DEFAULT_BACKOFF.factor;
  const maxMs = options.maxMs ?? DEFAULT_BACKOFF.maxMs;
  const jitterRatio = options.jitterRatio ?? DEFAULT_BACKOFF.jitterRatio;
  const random = options.random ?? Math.random;
  const growth = Math.pow(factor, Math.max(0, attempt));
  const wait = Math.min(maxMs, baseMs * growth);
  const jitter = (random() * 2 - 1) * jitterRatio;
  return Math.round(wait * (1 + jitter));
}
