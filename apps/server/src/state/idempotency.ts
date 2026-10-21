const DEFAULT_TTL_MS = 10 * 60 * 1000;

export type StoredResult = {
  /** The body the client received the first time. */
  body: unknown;
  /** The status the client received the first time. */
  status: number;
};

export type IdempotencyStore = {
  /** The result of the key, or undefined when the key is unknown or in flight. */
  get(userId: string, key: string): StoredResult | undefined;
  /**
   * Frees the key, so a new request with it can run.
   *
   * A key that already has a result is not freed: the result is the answer
   * of the request, and it outlives the request that produced it.
   */
  release(userId: string, key: string): void;
  /**
   * Takes the key, and says whether it was taken.
   *
   * The reservation is what keeps two requests of the same key from running
   * at the same time: the second one finds the key taken and does not run.
   */
  reserve(userId: string, key: string): boolean;
  /** Keeps the result of the key for the account. */
  set(userId: string, key: string, result: StoredResult): void;
};

export type IdempotencyStoreOptions = {
  /** The clock of the store: the tests move it by hand. */
  now?: () => number;
  /** How long a result is kept. */
  ttlMs?: number;
};

type StoredEntry = {
  expiresAt: number;
  kind: 'done';
  result: StoredResult;
};

type ReservedEntry = {
  expiresAt: number;
  kind: 'reserved';
};

type Entry = ReservedEntry | StoredEntry;

/**
 * The results of the commands that cost money.
 *
 * A buy that is retried after a timeout must not charge the player twice: the
 * client sends the same key, and the server answers with the result it already
 * gave. The key belongs to the account, because the same key of two accounts
 * are two different requests.
 *
 * The key is reserved before the command runs, and not only written at the
 * end: two requests of the same key that arrive together would both find the
 * key free, and both would charge the player. The reservation is taken
 * synchronously, so the second request finds the key taken and refuses to
 * run.
 *
 * The store lives in the memory of the process: the key is of short life, and
 * the window of ten minutes is the window of a retry.
 */
export function createIdempotencyStore(options?: IdempotencyStoreOptions): IdempotencyStore {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = options?.now ?? Date.now;
  const entries = new Map<string, Entry>();

  function get(userId: string, key: string): StoredResult | undefined {
    removeExpired(entries, now());
    const entry = entries.get(readKey(userId, key));
    if (entry === undefined || entry.kind === 'reserved') {
      return undefined;
    }
    return entry.result;
  }

  function reserve(userId: string, key: string): boolean {
    removeExpired(entries, now());
    const storedKey = readKey(userId, key);
    if (entries.has(storedKey)) {
      return false;
    }
    const entry: ReservedEntry = { expiresAt: now() + ttlMs, kind: 'reserved' };
    entries.set(storedKey, entry);
    return true;
  }

  function release(userId: string, key: string): void {
    const storedKey = readKey(userId, key);
    const entry = entries.get(storedKey);
    if (entry === undefined || entry.kind !== 'reserved') {
      return;
    }
    entries.delete(storedKey);
  }

  function set(userId: string, key: string, result: StoredResult): void {
    removeExpired(entries, now());
    const entry: StoredEntry = { expiresAt: now() + ttlMs, kind: 'done', result };
    entries.set(readKey(userId, key), entry);
  }

  return { get, release, reserve, set };
}

/**
 * The entries that already left the window are forgotten.
 *
 * The sweep happens when a result is written or read, which are the only
 * moments the store grows. A reservation that was never answered falls out
 * of the window too: a request that died in the middle leaves the key free
 * for the next one.
 */
function removeExpired(entries: Map<string, Entry>, now: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) {
      entries.delete(key);
    }
  }
}

function readKey(userId: string, key: string): string {
  return `${userId} ${key}`;
}
