import { randomBytes } from 'node:crypto';

const DEFAULT_TTL_MS = 30 * 1000;

export type IssuedTicket = {
  /** The moment the ticket stops opening the channel, in milliseconds. */
  expiresAt: number;
  /** The opaque value the client sends in the query of the upgrade. */
  ticket: string;
};

/**
 * The identity the ticket carries.
 *
 * The token travels with the ticket because the channel has to know that the
 * session behind it was not revoked: the ticket alone says who the account
 * is, and the token says that the account is still signed in.
 */
export type TicketIdentity = {
  /** The token of the account, read from the request that issued the ticket. */
  token: string;
  /** The account the ticket was issued for. */
  userId: string;
};

export type TicketStore = {
  /**
   * The identity of the ticket, or null when the ticket is unknown or expired.
   *
   * The ticket is of single use: consuming it removes it, so the same value
   * never opens two channels.
   */
  consume(ticket: string): TicketIdentity | null;
  /** Issues a ticket for the account, with the token that proves the session. */
  issue(userId: string, token: string): IssuedTicket;
};

export type TicketStoreOptions = {
  /** The clock of the store: the tests move it by hand. */
  now?: () => number;
  /** How long a ticket opens the channel. */
  ttlMs?: number;
};

type TicketEntry = {
  expiresAt: number;
  token: string;
  userId: string;
};

/**
 * The tickets that open the channel of the game.
 *
 * The ticket exists because the upgrade of the Bun does not receive headers,
 * and a token in the query string is written down by every proxy in front of
 * the server. The ticket carries the identity for thirty seconds and is of
 * single use, so a log that catches it is worthless a moment later.
 *
 * The token of the account travels inside the ticket, because the channel
 * has to revalidate it: it is the only way to know that the session behind
 * the token was not revoked. The token lives in the memory of the process for
 * at most the life of the ticket, and it is never logged.
 *
 * The store lives in the memory of the process, like the session of the
 * trainer and the registry of the connections.
 */
export function createTicketStore(options?: TicketStoreOptions): TicketStore {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = options?.now ?? Date.now;
  const tickets = new Map<string, TicketEntry>();

  function issue(userId: string, token: string): IssuedTicket {
    removeExpired();
    const ticket = randomBytes(32).toString('base64url');
    const expiresAt = now() + ttlMs;
    tickets.set(ticket, { expiresAt, token, userId });
    return { expiresAt, ticket };
  }

  function consume(ticket: string): TicketIdentity | null {
    const entry = tickets.get(ticket);
    if (entry === undefined) {
      return null;
    }
    tickets.delete(ticket);
    if (entry.expiresAt <= now()) {
      return null;
    }
    return { token: entry.token, userId: entry.userId };
  }

  /**
   * The tickets that already expired are forgotten.
   *
   * The sweep happens when a ticket is issued, which is the only moment the
   * store grows: a ticket that is never consumed would live in the memory
   * until the next issue.
   */
  function removeExpired(): void {
    const at = now();
    for (const [ticket, entry] of tickets) {
      if (entry.expiresAt <= at) {
        tickets.delete(ticket);
      }
    }
  }

  return { consume, issue };
}
