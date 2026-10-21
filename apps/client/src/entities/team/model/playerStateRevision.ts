/**
 * The revision of the state that the client has applied.
 *
 * The revision only means something inside the epoch: the server keeps the
 * counter in memory, so a restart of the server resets it.
 */
export type AppliedRevision = {
  /** The boot of the server that produced the state. */
  epoch: string;
  /** The revision of the state inside the epoch. */
  rev: number;
};

/**
 * What the client does with a state that arrives.
 */
export type RevisionDecision = 'accept' | 'ignore' | 'resync';

/**
 * The comparison of the revisions.
 *
 * The epoch comes first: a server that restarted has a counter that starts
 * over, and a client that only compared the revision would refuse every state
 * of the new server and stay frozen in an old one.
 */
export function decideRevision(
  current: AppliedRevision | null,
  incoming: AppliedRevision,
): RevisionDecision {
  if (current === null) {
    return 'accept';
  }
  if (current.epoch !== incoming.epoch) {
    return 'resync';
  }
  if (incoming.rev > current.rev) {
    return 'accept';
  }
  return 'ignore';
}

/**
 * Whether the state that arrived skips a revision.
 *
 * A gap means that a state was lost on the way: the client asks for the state
 * that the server has, instead of waiting for a push that will never come.
 */
export function isRevisionGap(current: AppliedRevision | null, incoming: AppliedRevision): boolean {
  if (current === null || current.epoch !== incoming.epoch) {
    return false;
  }
  return incoming.rev > current.rev + 1;
}
