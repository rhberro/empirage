import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';

import type { AttemptLimiter } from '~/ratelimit/attemptLimiter';
import type { PublicLimiter } from '~/ratelimit/publicLimiter';
import type { TrainerSessionStore } from '~/session/trainerSession';
import type { IdempotencyStore } from '~/state/idempotency';
import type { RevCounter } from '~/state/rev';
import type { ClaimsReader, UserReader } from '~/supabase';
import type { ConnectionRegistry } from '~/ws/connections';
import type { StateBroadcaster } from '~/ws/stateBroadcaster';
import type { TicketStore } from '~/ws/tickets';

export type ServerDependencies = {
  admin: SupabaseClient;
  broadcaster: StateBroadcaster;
  claims: ClaimsReader;
  /** The open channels of the accounts. */
  connections: ConnectionRegistry;
  /** The results of the commands that cost money, per account. */
  idempotency: IdempotencyStore;
  /** The failed attempts of the accounts and of the addresses, per process. */
  limiter: AttemptLimiter;
  logger: Logger;
  /** The requests of the public routes, per address, per process. */
  publicLimiter: PublicLimiter;
  /** The revision of the state of every account. */
  revs: RevCounter;
  sessions: TrainerSessionStore;
  /** The tickets that open the channel of the game. */
  tickets: TicketStore;
  users: UserReader;
};
