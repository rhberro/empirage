import type { Server } from 'bun';

import type { ServerDependencies } from '~/dependencies';
import { errorResponse } from '~/router';
import type { SocketData } from '~/ws/connections';

const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const UNAUTHENTICATED_ERROR = 'unauthenticated';
const INVALID_TICKET_MESSAGE = 'Ticket inválido ou expirado.';
const MISSING_TICKET_MESSAGE = 'Ticket inválido ou ausente.';

export type WebSocketUpgrade = (
  req: Request,
  bunServer: Server<SocketData>,
) => Promise<Response | undefined>;

/**
 * The opening of the channel of the game.
 *
 * The channel is only opened for a ticket the server issued, and the ticket
 * does not travel the token of the account: the token travels inside the
 * ticket, and it is revalidated here, against the Auth server.
 *
 * The revalidation is the only way to know that the session behind the token
 * was not revoked: the token keeps being valid after the session behind it
 * ends, and the game has to refuse the channel of a session that is over.
 * The cost is one call to the Auth server per channel, the same cost the
 * opening had when the token travelled in the query.
 *
 * A ticket that is unknown, that already expired or that was already used is
 * refused with the status 401: the browser sees a handshake that failed, and
 * not a channel that closes itself right after being opened.
 */
export function createWebSocketUpgrade(deps: ServerDependencies): WebSocketUpgrade {
  return function upgrade(
    req: Request,
    bunServer: Server<SocketData>,
  ): Promise<Response | undefined> {
    const url = new globalThis.URL(req.url);
    const ticket = url.searchParams.get('ticket');
    if (ticket === null || ticket === '') {
      return Promise.resolve(
        errorResponse(UNAUTHORIZED, UNAUTHENTICATED_ERROR, MISSING_TICKET_MESSAGE),
      );
    }
    const identity = deps.tickets.consume(ticket);
    if (identity === null) {
      return Promise.resolve(
        errorResponse(UNAUTHORIZED, UNAUTHENTICATED_ERROR, INVALID_TICKET_MESSAGE),
      );
    }
    return deps.users.readUserId(identity.token).then(function openChannel(
      userId: string | null,
    ): Response | undefined {
      if (userId === null || userId !== identity.userId) {
        return errorResponse(UNAUTHORIZED, UNAUTHENTICATED_ERROR, INVALID_TICKET_MESSAGE);
      }
      const data: SocketData = { userId };
      const options = { data };
      const upgraded = bunServer.upgrade(req, options);
      if (!upgraded) {
        return errorResponse(BAD_REQUEST, 'upgrade_failed', 'Não foi possível abrir o canal.');
      }
      deps.logger.info({ userId }, 'websocket channel opened');
      return undefined;
    });
  };
}
