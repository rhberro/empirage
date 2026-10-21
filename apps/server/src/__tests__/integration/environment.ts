import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pino from 'pino';

import type { ServerDependencies } from '~/dependencies';
import { createAttemptLimiter } from '~/ratelimit/attemptLimiter';
import { createPublicLimiter } from '~/ratelimit/publicLimiter';
import { createTrainerSessionStore } from '~/session/trainerSession';
import { createIdempotencyStore } from '~/state/idempotency';
import { createRevCounter } from '~/state/rev';
import { createSupabaseServer, readSupabaseEnv } from '~/supabase';
import { createConnectionRegistry } from '~/ws/connections';
import type { ConnectionRegistry } from '~/ws/connections';
import { createStateBroadcaster } from '~/ws/stateBroadcaster';
import { createTicketStore } from '~/ws/tickets';

export const TEST_PASSWORD = 'creatures-integration-pass';
export const STARTER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

export type TrainerBody = {
  gender: string;
  name: string;
  starterSpeciesId: string;
};

export type TrainerPayload = {
  id: string;
  name: string;
  starterSpeciesId: string;
};

export type IntegrationEnvironment = {
  admin: SupabaseClient;
  anon: SupabaseClient;
  connections: ConnectionRegistry;
  deps: ServerDependencies;
  otherEmail: string;
  otherId: string;
  ownerEmail: string;
  ownerId: string;
};

export function prepareEnvironment(): Promise<IntegrationEnvironment> {
  return ensureEnv().then(function build(): Promise<IntegrationEnvironment> {
    const env = readSupabaseEnv(globalThis.process.env);
    const supabase = createSupabaseServer(env);
    const admin = supabase.admin;
    const anon = createClient(env.url, env.anonKey);
    const logger = pino({ level: 'silent' });
    const connections = createConnectionRegistry();
    const revs = createRevCounter();
    const deps: ServerDependencies = {
      admin,
      broadcaster: createStateBroadcaster(admin, connections, logger, revs),
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
    const ownerEmail = buildTestEmail();
    const otherEmail = buildTestEmail();
    return createTestUser(admin, ownerEmail).then(function withOwner(
      ownerId: string,
    ): PromiseLike<IntegrationEnvironment> {
      return createTestUser(admin, otherEmail).then(function withOther(
        otherId: string,
      ): IntegrationEnvironment {
        return {
          admin,
          anon,
          connections,
          deps,
          otherEmail,
          otherId,
          ownerEmail,
          ownerId,
        };
      });
    });
  });
}

export function cleanupEnvironment(env: IntegrationEnvironment): Promise<unknown> {
  const ownTrainers = env.admin.from('trainers').delete().eq('owner_id', env.ownerId);
  const otherTrainers = env.admin.from('trainers').delete().eq('owner_id', env.otherId);
  return Promise.resolve(ownTrainers.then(readDeletion))
    .then(function cleanOther(): PromiseLike<unknown> {
      return otherTrainers.then(readDeletion);
    })
    .then(function removeOwner(): Promise<unknown> {
      return env.admin.auth.admin.deleteUser(env.ownerId);
    })
    .then(function removeOther(): Promise<unknown> {
      return env.admin.auth.admin.deleteUser(env.otherId);
    });
}

export function readToken(env: IntegrationEnvironment, email: string): Promise<string> {
  return env.anon.auth
    .signInWithPassword({ email, password: TEST_PASSWORD })
    .then(function readSession(result: {
      data: { session: { access_token: string } | null };
      error: { message: string } | null;
    }): string {
      if (result.error !== null || result.data.session === null) {
        throw new Error(`Test sign in failed: ${result.error?.message ?? 'no session'}`);
      }
      return result.data.session.access_token;
    });
}

export function createTestUser(client: SupabaseClient, email: string): Promise<string> {
  return client.auth.admin
    .createUser({ email, email_confirm: true, password: TEST_PASSWORD })
    .then(function readUser(result: {
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }): string {
      if (result.error !== null || result.data.user === null) {
        throw new Error(`Test user creation failed: ${result.error?.message ?? 'no user'}`);
      }
      return result.data.user.id;
    });
}

export function buildTrainerBody(name: string): TrainerBody {
  return { gender: 'male', name, starterSpeciesId: STARTER_ID };
}

export function buildTestName(): string {
  return `T${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
}

export function buildTestEmail(): string {
  return `qa.server.${globalThis.crypto.randomUUID().slice(0, 8)}@exemplo.com`;
}

/**
 * A captured creature that is not in the team, written straight to the
 * database: the capture flow does not exist yet.
 */
export function createCreature(
  env: IntegrationEnvironment,
  trainerId: string,
  speciesId: string,
  capturedAt: string,
): Promise<string> {
  const row = {
    captured_at: capturedAt,
    experience: 0,
    is_in_team: false,
    level: 1,
    nickname: null,
    potential: {
      magicAttack: 50,
      magicDefense: 50,
      physicalAttack: 50,
      physicalDefense: 50,
      vitality: 50,
    },
    species_id: speciesId,
    team_slot: null,
    trainer_id: trainerId,
  };
  const query = env.admin.from('creatures').insert(row).select('id').single();
  return Promise.resolve(query.then(readCreatureId));
}

function readCreatureId(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}): string {
  if (result.error !== null || result.data === null) {
    throw new Error(`Test creature creation failed: ${result.error?.message ?? 'no creature'}`);
  }
  return result.data.id;
}

export function countRows(result: { data: unknown[] | null }): number {
  return (result.data ?? []).length;
}

function readDeletion(): { data: unknown[] | null } {
  return { data: [] };
}

function ensureEnv(): Promise<void> {
  if (globalThis.process.env.SUPABASE_URL !== undefined) {
    return Promise.resolve();
  }
  const file = globalThis.Bun.file(`${import.meta.dir}/../../../.env`);
  return file.exists().then(function load(found: boolean): Promise<void> {
    if (!found) {
      throw new Error('SUPABASE_URL is missing and apps/server/.env was not found');
    }
    return file.text().then(function apply(content: string): void {
      for (const line of content.split('\n')) {
        applyEnvLine(line);
      }
    });
  });
}

function applyEnvLine(line: string): void {
  const [key, ...rest] = line.split('=');
  if (key === undefined || rest.length === 0) {
    return;
  }
  const name = key.trim();
  if (name === '' || globalThis.process.env[name] !== undefined) {
    return;
  }
  globalThis.process.env[name] = rest.join('=').trim();
}
