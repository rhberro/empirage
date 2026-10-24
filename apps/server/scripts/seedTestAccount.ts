/**
 * A test account with more than one creature in the team.
 *
 * The manual swap of the active creature needs a team with room to move, and
 * a single creature cannot show it. This script gives the test account a team
 * of four creatures, of four different species, with different potentials, so
 * the swap and the five second cooldown can be exercised.
 *
 * The script is idempotent: running it again leaves the same team.
 *
 *   bun run --filter @creatures/server seed:test-account
 */
import { createClient } from '@supabase/supabase-js';

import { equipSpeciesAbilities } from './seedTestAccountAbilities';
import { readSeedEnv } from './seedTestAccountEnv';
import type { SeedEnv } from './seedTestAccountEnv';
import type { SpeciesRow } from './seedTestAccountSeeds';
import {
  addToTeam,
  ensureAccount,
  ensurePotions,
  ensureTrainer,
  insertCreatures,
  readSpecies,
  readTeam,
  resetCreatures,
} from './seedTestAccountStore';
import type { SeedContext } from './seedTestAccountStore';

const ACCOUNT_EMAIL = 'qa.e2e.2026@exemplo.com';
const TRAINER_NAME = 'Time de Teste';

function main(): Promise<void> {
  return readSeedEnv()
    .then(createAdmin)
    .then(ensureAccount)
    .then(readSpecies)
    .then(ensureTrainer)
    .then(resetCreatures)
    .then(insertCreatures)
    .then(equipSpeciesAbilities)
    .then(addToTeam)
    .then(ensurePotions)
    .then(readTeam)
    .then(printSummary);
}

function createAdmin(env: SeedEnv): SeedContext {
  const admin = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
  });
  return {
    admin,
    creatureIds: [],
    ownerId: '',
    species: new Map<string, SpeciesRow>(),
    team: [],
    trainerId: '',
  };
}

function printSummary(ctx: SeedContext): void {
  globalThis.console.log(`Conta de teste pronta: ${ACCOUNT_EMAIL}`);
  globalThis.console.log(`Treinador: ${TRAINER_NAME} (${ctx.trainerId})`);
  for (const entry of ctx.team) {
    globalThis.console.log(`  slot ${entry.slot}: ${entry.nickname} (${entry.species})`);
  }
}

function handleFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  globalThis.console.error(message);
  globalThis.process.exit(1);
}

try {
  await main();
} catch (error) {
  handleFailure(error);
}
