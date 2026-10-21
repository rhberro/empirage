import { readBearerToken } from '~/auth/bearer';
import type { ServerDependencies } from '~/dependencies';
import { defineRoute, errorResponse, jsonResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import { composeProtectedRoute } from '~/routes/routeChain';

const WS_TICKET_PATH = '/api/ws-ticket';
const OK = 200;
const UNAUTHENTICATED = 401;
const UNAUTHENTICATED_ERROR = 'unauthenticated';
const UNAUTHENTICATED_MESSAGE = 'Token inválido ou ausente.';

export function createWsTicketRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute('POST', WS_TICKET_PATH, composeProtectedRoute(deps, handleIssueTicket(deps))),
  ];
}

/**
 * Issues the ticket that opens the channel of the game.
 *
 * The ticket is of single use and of short life, and it is the only thing
 * that travels in the query of the upgrade: the token of the account stays in
 * the header of this request, where no proxy writes it down.
 *
 * The token travels inside the ticket, because the upgrade has to know that
 * the session behind it was not revoked. The ticket and the token are never
 * logged.
 */
function handleIssueTicket(deps: ServerDependencies): RouteHandler {
  return function issueTicket(
    req: Request,
    _params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(
        errorResponse(UNAUTHENTICATED, UNAUTHENTICATED_ERROR, UNAUTHENTICATED_MESSAGE),
      );
    }
    const token = readBearerToken(req);
    if (token === null) {
      return Promise.resolve(
        errorResponse(UNAUTHENTICATED, UNAUTHENTICATED_ERROR, UNAUTHENTICATED_MESSAGE),
      );
    }
    const issued = deps.tickets.issue(userId, token);
    return Promise.resolve(
      jsonResponse({ expiresAt: issued.expiresAt, ticket: issued.ticket }, OK),
    );
  };
}
