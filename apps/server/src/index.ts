import { serve, type Server } from 'bun';

import type { ServerDependencies } from '~/dependencies';
import { createServerLogger } from '~/logging/logger';
import { createCorsMiddleware } from '~/middleware/cors';
import { createLoggingMiddleware, createResponseLogger } from '~/middleware/logging';
import { createAttemptLimiter } from '~/ratelimit/attemptLimiter';
import { createPublicLimiter } from '~/ratelimit/publicLimiter';
import {
  buildHttpHandler,
  composeMiddleware,
  createErrorBoundary,
  createRequestContext,
} from '~/router';
import { createAuthRoutes } from '~/routes/auth';
import { createBackpackRoutes } from '~/routes/backpack';
import { createCreatureRoutes } from '~/routes/creatures';
import { createGearSlotRoutes } from '~/routes/gearSlots';
import { createHealthRoutes } from '~/routes/health';
import { createHuntAreaRoutes } from '~/routes/huntAreas';
import { createLoadoutRoutes } from '~/routes/loadout';
import { createPlayerRoutes } from '~/routes/player';
import { createSpeciesRoutes } from '~/routes/species';
import { createStarterRoutes } from '~/routes/starters';
import { createStoreRoutes } from '~/routes/store';
import { createTeamRoutes } from '~/routes/team';
import { createTrainerRoutes } from '~/routes/trainers';
import { createWsTicketRoutes } from '~/routes/wsTicket';
import { createTrainerSessionStore } from '~/session/trainerSession';
import { createIdempotencyStore } from '~/state/idempotency';
import { createRevCounter } from '~/state/rev';
import { createSupabaseServer, readSupabaseEnv } from '~/supabase';
import { createConnectionRegistry } from '~/ws/connections';
import type { SocketData } from '~/ws/connections';
import { createGameSocketHandler } from '~/ws/gameSocket';
import { createLivenessScanner } from '~/ws/liveness';
import { createStateBroadcaster } from '~/ws/stateBroadcaster';
import { createTicketStore } from '~/ws/tickets';
import { createWebSocketUpgrade } from '~/ws/upgrade';

const DEFAULT_PORT = 3001;
const WS_PATH = '/ws';
const TRUSTED_PROXY = '1';
/**
 * The biggest message the channel accepts, in bytes.
 */
const WS_MAX_PAYLOAD_BYTES = 64 * 1024;
/**
 * The seconds a connection can stay idle before the runtime closes it.
 *
 * What the documentation of the Bun says, and what the code counts on:
 *
 * - The unit is the second, the range goes from 0 to 960, and 0 turns the
 *   timeout and the automatic pings off.
 * - The Bun pings the client shortly before the timeout, and the pong of the
 *   client keeps an idle connection open. The timeout is the silence of the
 *   connection, and the pong of the protocol is what breaks that silence.
 * - The pong of the protocol does not arrive in the `message` event: it has
 *   its own `pong` handler, and that is where the server marks the
 *   connection as alive.
 * - The browser answers the ping of the protocol by itself, and not with the
 *   code of the client, whose timer is strangled in a tab in the background.
 *
 * The timeout is larger than the interval of the ping of the client anyway,
 * so a healthy connection is never dropped because of a timer that was
 * throttled.
 */
const WS_IDLE_TIMEOUT_SECONDS = 120;

const logger = createServerLogger();
const supabase = createSupabaseServer(readSupabaseEnv(globalThis.process.env));
const connections = createConnectionRegistry();
const revs = createRevCounter();
const deps: ServerDependencies = {
  admin: supabase.admin,
  broadcaster: createStateBroadcaster(supabase.admin, connections, logger, revs),
  claims: supabase.claims,
  connections,
  idempotency: createIdempotencyStore(),
  limiter: createAttemptLimiter(),
  logger,
  publicLimiter: createPublicLimiter(),
  revs,
  sessions: createTrainerSessionStore(),
  tickets: createTicketStore(),
  users: supabase.users,
};
const routes = createTrainerRoutes(deps)
  .concat(createStarterRoutes(deps))
  .concat(createSpeciesRoutes(deps))
  .concat(createCreatureRoutes(deps))
  .concat(createPlayerRoutes(deps))
  .concat(createTeamRoutes(deps))
  .concat(createAuthRoutes(deps))
  .concat(createHuntAreaRoutes(deps))
  .concat(createLoadoutRoutes(deps))
  .concat(createGearSlotRoutes(deps))
  .concat(createStoreRoutes(deps))
  .concat(createBackpackRoutes(deps))
  .concat(createWsTicketRoutes(deps))
  .concat(createHealthRoutes());
const middlewares = [
  createLoggingMiddleware(logger),
  createCorsMiddleware(globalThis.process.env.CLIENT_ORIGIN),
];
const routeHandler = createErrorBoundary(
  logger,
  composeMiddleware(middlewares, buildHttpHandler(routes, createResponseLogger(logger))),
);
const port = Number(globalThis.process.env.PORT ?? DEFAULT_PORT);
const trustProxy = globalThis.process.env.TRUST_PROXY === TRUSTED_PROXY;
const webSocketUpgrade = createWebSocketUpgrade(deps);

serve({
  fetch: fetchHandler,
  port,
  websocket: {
    ...createGameSocketHandler(deps, connections),
    idleTimeout: WS_IDLE_TIMEOUT_SECONDS,
    maxPayloadLength: WS_MAX_PAYLOAD_BYTES,
    sendPings: true,
  },
});

/**
 * The net below the timer of the runtime.
 *
 * The idle timeout of the Bun closes a connection that went quiet, but the
 * server does not trust that timer alone: the sweep closes the connections
 * that were not heard from for longer than the limit, counting the pong of
 * the protocol as a sign of life.
 */
createLivenessScanner(connections, logger);

logger.info({ port }, 'creatures server listening');

function fetchHandler(req: Request, bunServer: Server<SocketData>): Promise<Response | undefined> {
  const url = new globalThis.URL(req.url);
  if (url.pathname === WS_PATH) {
    return webSocketUpgrade(req, bunServer);
  }
  const params: Record<string, string> = {};
  const ctx = createRequestContext();
  ctx.clientIp = readClientIp(req, bunServer);
  return routeHandler(req, params, ctx);
}

/**
 * The address the request came from.
 *
 * The header of the proxy is only read when the server is told to trust it: a
 * client that reaches the server directly could invent any address it wanted,
 * and the limit of the address would not hold.
 */
function readClientIp(req: Request, bunServer: Server<SocketData>): string | null {
  if (trustProxy) {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded !== null) {
      const first = forwarded.split(',')[0]?.trim();
      if (first !== undefined && first !== '') {
        return first;
      }
    }
  }
  const address = bunServer.requestIP(req);
  return address?.address ?? null;
}
