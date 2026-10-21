export type RevCounter = {
  /** The revision the state of the account is at right now. */
  current(userId: string): number;
  /** The identifier of the boot of the process. */
  epoch: string;
  /** The next revision of the state of the account. */
  next(userId: string): number;
};

/**
 * The revision of the state of every account.
 *
 * The counter is monotonic inside the epoch, and the epoch changes when the
 * process boots again: a client that only compared the revision would refuse
 * every snapshot of the new process, because the counter starts over at zero.
 *
 * The counter lives in the memory of the process, like the session of the
 * trainer and the registry of the connections.
 */
export function createRevCounter(epoch?: string): RevCounter {
  const revisions = new Map<string, number>();
  const bootEpoch = epoch ?? globalThis.crypto.randomUUID();

  function next(userId: string): number {
    const rev = (revisions.get(userId) ?? 0) + 1;
    revisions.set(userId, rev);
    return rev;
  }

  function current(userId: string): number {
    return revisions.get(userId) ?? 0;
  }

  return { current, epoch: bootEpoch, next };
}
