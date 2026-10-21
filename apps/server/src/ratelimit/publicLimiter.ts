import { errorResponse } from '~/router';
import type { RequestContext, RouteHandler } from '~/router';

const DEFAULT_MAX_REQUESTS = 120;
const DEFAULT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_ERROR = 'rate_limited';
const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Tente novamente em alguns minutos.';
const RETRY_AFTER_SECONDS = 60;

export type PublicLimiter = {
  /** Whether the key already asked for more than the limit inside the window. */
  isBlocked(key: string): boolean;
  /** Registers a request of the key. */
  record(key: string): void;
  /** Forgets every request: used by the tests. */
  reset(): void;
};

export type PublicLimiterOptions = {
  /** How many requests the key may have inside the window. */
  maxRequests?: number;
  /** The clock of the limiter: the tests move it by hand. */
  now?: () => number;
  /** How long a request is remembered. */
  windowMs?: number;
};

/**
 * The requests of the routes that are open to anyone.
 *
 * A public route has no account to count: the address the request came from
 * is what is counted. The counter is per process and lives in the memory of
 * the process, like the counter of the failed attempts.
 */
export function createPublicLimiter(options?: PublicLimiterOptions): PublicLimiter {
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options?.now ?? Date.now;
  const requests = new Map<string, number[]>();

  function isBlocked(key: string): boolean {
    return readRequests(key).length >= maxRequests;
  }

  function record(key: string): void {
    const asked = readRequests(key);
    asked.push(now());
    requests.set(key, asked);
  }

  function reset(): void {
    requests.clear();
  }

  /**
   * The requests of the key that are still inside the window. The ones that
   * left it are forgotten, which is what makes the counter forget on its own.
   */
  function readRequests(key: string): number[] {
    const asked = (requests.get(key) ?? []).filter(function isInsideWindow(at: number): boolean {
      return now() - at < windowMs;
    });
    if (asked.length === 0) {
      requests.delete(key);
      return [];
    }
    requests.set(key, asked);
    return asked;
  }

  return { isBlocked, record, reset };
}

/**
 * The guard of a public route: the requests of the address are counted.
 *
 * The route that answers with the catalog of the starters is public, and the
 * content of the catalog is the same for everybody. Asking for a token only
 * costs the client a session it already has, and keeps the answer of the
 * route out of the cache of everybody.
 */
export function limitPublicRoute(limiter: PublicLimiter, handler: RouteHandler): RouteHandler {
  return function limitedHandler(
    req: Request,
    params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const key = readKey(ctx);
    if (key === null) {
      return handler(req, params, ctx);
    }
    if (limiter.isBlocked(key)) {
      return Promise.resolve(rateLimitedResponse());
    }
    limiter.record(key);
    return handler(req, params, ctx);
  };
}

/**
 * The key of the address.
 *
 * Without an address there is nobody to count: the server answers, because a
 * limit that counts everybody at once is a limit that blocks the game.
 */
function readKey(ctx: RequestContext): string | null {
  if (ctx.clientIp === null || ctx.clientIp === '') {
    return null;
  }
  return `ip:${ctx.clientIp}`;
}

function rateLimitedResponse(): Response {
  const response = errorResponse(RATE_LIMIT_STATUS, RATE_LIMIT_ERROR, RATE_LIMIT_MESSAGE);
  response.headers.set('Retry-After', String(RETRY_AFTER_SECONDS));
  return response;
}
