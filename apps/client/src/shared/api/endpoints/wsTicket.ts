import type { ApiDeps } from '~/shared/api/client';
import { buildHeaders, isSuccessStatus, resolveErrorCode } from '~/shared/api/http';
import type { TrainerClientErrorCode } from '~/shared/api/http';

const WS_TICKET_PATH = '/api/ws-ticket';
const UNAUTHENTICATED: TrainerClientErrorCode = 'unauthenticated';

export type WsTicketResult =
  | { ok: true; ticket: string; expiresAt: number }
  | { ok: false; code: TrainerClientErrorCode };

/**
 * The ticket that opens the WebSocket.
 *
 * The ticket is of one use and lives for half a minute: it replaces the token
 * in the query string, where any proxy in front of the server would write it
 * down.
 *
 * The request needs the session: a player without one has no ticket to ask
 * for, and the request is not even made.
 */
export function requestWsTicket(deps: ApiDeps): Promise<WsTicketResult> {
  return deps.getAccessToken().then(buildTicketRequester(deps));
}

function buildTicketRequester(deps: ApiDeps): (token: string | null) => Promise<WsTicketResult> {
  return function askTicketWithToken(token: string | null): Promise<WsTicketResult> {
    if (token === null) {
      return Promise.resolve({ code: UNAUTHENTICATED, ok: false });
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'POST' };
    return globalThis
      .fetch(buildWsTicketUrl(deps.baseUrl), init)
      .then(readTicketResponse)
      .catch(readTicketNetworkFailure);
  };
}

function readTicketResponse(response: Response): Promise<WsTicketResult> {
  return response
    .json()
    .then(buildTicketResult(response.status), buildUnreadableTicketResult(response.status));
}

function buildTicketResult(status: number): (body: unknown) => WsTicketResult {
  return function toTicketResult(body: unknown): WsTicketResult {
    if (!isSuccessStatus(status)) {
      return { code: resolveErrorCode(status, body), ok: false };
    }
    const ticket = readTicket(body);
    if (ticket === null) {
      return { code: 'unknown', ok: false };
    }
    return { expiresAt: ticket.expiresAt, ok: true, ticket: ticket.ticket };
  };
}

function buildUnreadableTicketResult(status: number): () => WsTicketResult {
  return function toUnreadableTicketResult(): WsTicketResult {
    return { code: resolveErrorCode(status, null), ok: false };
  };
}

function readTicketNetworkFailure(): WsTicketResult {
  return { code: 'unknown', ok: false };
}

type WsTicketBody = {
  expiresAt: number;
  ticket: string;
};

function readTicket(body: unknown): WsTicketBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const entry = body as { expiresAt?: unknown; ticket?: unknown };
  if (typeof entry.ticket !== 'string' || entry.ticket.length === 0) {
    return null;
  }
  if (typeof entry.expiresAt !== 'number') {
    return null;
  }
  return { expiresAt: entry.expiresAt, ticket: entry.ticket };
}

function buildWsTicketUrl(baseUrl: string): string {
  return `${baseUrl}${WS_TICKET_PATH}`;
}
