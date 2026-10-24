import type { MoveOutcome } from '~/world/registryTypes';

/** The window a repeated `reqId` is answered from the cache. */
export const MOVE_CACHE_TTL_MS = 30_000;

export type CachedMove = {
  expiresAt: number;
  outcome: MoveOutcome;
};

export function readCachedMove(
  moves: Map<string, CachedMove>,
  userId: string,
  reqId: string,
  at: number,
): MoveOutcome | undefined {
  const key = readRequestKey(userId, reqId);
  const cached = moves.get(key);
  if (cached === undefined) {
    return undefined;
  }
  if (cached.expiresAt <= at) {
    moves.delete(key);
    return undefined;
  }
  return cached.outcome;
}

export function writeCachedMove(
  moves: Map<string, CachedMove>,
  userId: string,
  reqId: string,
  outcome: MoveOutcome,
  at: number,
): void {
  moves.set(readRequestKey(userId, reqId), {
    expiresAt: at + MOVE_CACHE_TTL_MS,
    outcome,
  });
}

function readRequestKey(userId: string, reqId: string): string {
  return `${userId} ${reqId}`;
}
