/* eslint-disable max-lines */
/**
 * Data access for the test account seed script.
 *
 * Every step takes the seed context and returns the updated context, so the
 * steps can be chained without sharing mutable state.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { CREATURE_COUNT, CREATURE_SEEDS } from './seedTestAccountSeeds';
import type { CreatureSeed, SpeciesRow } from './seedTestAccountSeeds';

const ACCOUNT_EMAIL = 'qa.e2e.2026@exemplo.com';
const ACCOUNT_PASSWORD = 'Creatures#2026qa';
const TRAINER_NAME = 'Time de Teste';
const TRAINER_NORMALIZED_NAME = 'time de teste';
const STARTER_SPECIES_SLUG = 'brasa';

export type AdminClient = SupabaseClient;

export type TeamEntry = {
  nickname: string;
  slot: number;
  species: string;
};

export type SeedContext = {
  admin: AdminClient;
  creatureIds: string[];
  ownerId: string;
  species: Map<string, SpeciesRow>;
  team: TeamEntry[];
  trainerId: string;
};

type TeamRow = {
  nickname: string | null;
  species: unknown;
  team_slot: number | null;
};

type CreateUserResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};

type ListUsersResult = {
  data: { users: { email?: string; id: string }[] };
  error: { message: string } | null;
};

type RowsResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export function ensureAccount(ctx: SeedContext): Promise<SeedContext> {
  return findAccountId(ctx.admin).then(function withOwner(ownerId: string): SeedContext {
    return { ...ctx, ownerId };
  });
}

export function readSpecies(ctx: SeedContext): Promise<SeedContext> {
  const query = ctx.admin.from('species').select('id, name, slug');
  return Promise.resolve(query).then(function readRows(
    result: RowsResult<SpeciesRow>,
  ): SeedContext {
    if (result.error !== null) {
      throw new Error(`Falha ao ler as espécies: ${result.error.message}`);
    }
    const species = new Map<string, SpeciesRow>();
    for (const row of result.data ?? []) {
      species.set(row.slug, row);
    }
    return { ...ctx, species };
  });
}

export function ensureTrainer(ctx: SeedContext): Promise<SeedContext> {
  return findTrainerId(ctx).then(function reuseOrCreate(
    trainerId: string | null,
  ): SeedContext | Promise<SeedContext> {
    if (trainerId !== null) {
      return { ...ctx, trainerId };
    }
    return createTrainer(ctx).then(function withCreated(createdId: string): SeedContext {
      return { ...ctx, trainerId: createdId };
    });
  });
}

export function resetCreatures(ctx: SeedContext): Promise<SeedContext> {
  const query = ctx.admin.from('creatures').delete().eq('trainer_id', ctx.trainerId);
  return Promise.resolve(query).then(function cleared(result: {
    data: unknown;
    error: { message: string } | null;
  }): SeedContext {
    if (result.error !== null) {
      throw new Error(`Falha ao limpar as criaturas: ${result.error.message}`);
    }
    return ctx;
  });
}

export function insertCreatures(ctx: SeedContext): Promise<SeedContext> {
  return insertSeed(ctx, CREATURE_SEEDS.slice(0, CREATURE_COUNT), 0);
}

export function addToTeam(ctx: SeedContext): Promise<SeedContext> {
  return addCreatureToTeam(ctx, ctx.creatureIds, 0);
}

/**
 * Gives the test trainer the healing potion the hunt consumes.
 *
 * The starter backpack is not part of the seed of this account, so a fresh
 * run would leave the bar with the potion equipped and no unit to drink.
 */
export function ensurePotions(ctx: SeedContext): Promise<SeedContext> {
  const query = ctx.admin.from('items').select('id').eq('slug', 'pocao-de-cura').limit(1);
  return Promise.resolve(query).then(function withItem(
    result: RowsResult<{ id: string }>,
  ): Promise<SeedContext> {
    if (result.error !== null) {
      throw new Error(`Falha ao procurar a poção: ${result.error.message}`);
    }
    const item = result.data?.[0];
    if (item === undefined) {
      throw new Error('A poção de cura não está no catálogo.');
    }
    const items = ctx.admin
      .from('trainer_items')
      .upsert(
        { item_id: item.id, quantity: 30, trainer_id: ctx.trainerId },
        { onConflict: 'trainer_id,item_id' },
      );
    const gear = ctx.admin.from('trainer_gear_slots').upsert(
      {
        item_id: item.id,
        kind: 'consumable',
        slot: 4,
        trainer_id: ctx.trainerId,
        trigger_hp_percent: 40,
      },
      { onConflict: 'trainer_id,slot' },
    );
    return Promise.all([
      Promise.resolve(items).then(readWriteFailure('a poção')),
      Promise.resolve(gear).then(readWriteFailure('o slot da poção')),
    ]).then(function done(): SeedContext {
      return ctx;
    });
  });
}

function readWriteFailure(label: string): (result: { error: { message: string } | null }) => void {
  return function check(result: { error: { message: string } | null }): void {
    if (result.error !== null) {
      throw new Error(`Falha ao gravar ${label}: ${result.error.message}`);
    }
  };
}

export function readTeam(ctx: SeedContext): Promise<SeedContext> {
  const query = ctx.admin
    .from('creatures')
    .select('nickname, team_slot, species:species(name)')
    .eq('trainer_id', ctx.trainerId)
    .eq('is_in_team', true)
    .order('team_slot');
  return Promise.resolve(query).then(function readRows(result: RowsResult<TeamRow>): SeedContext {
    if (result.error !== null) {
      throw new Error(`Falha ao ler o time: ${result.error.message}`);
    }
    const team = (result.data ?? []).map(mapTeamRow);
    return { ...ctx, team };
  });
}

function findAccountId(admin: AdminClient): Promise<string> {
  const params = {
    email: ACCOUNT_EMAIL,
    email_confirm: true,
    password: ACCOUNT_PASSWORD,
  };
  return Promise.resolve(admin.auth.admin.createUser(params)).then(function readCreated(
    result: CreateUserResult,
  ): string | Promise<string> {
    if (result.error === null && result.data.user !== null) {
      return result.data.user.id;
    }
    return listAccountId(admin, result.error);
  });
}

function listAccountId(
  admin: AdminClient,
  createError: { message: string } | null,
): Promise<string> {
  return Promise.resolve(admin.auth.admin.listUsers({ page: 1, perPage: 200 })).then(
    function readUsers(result: ListUsersResult): string {
      if (result.error !== null) {
        throw new Error(`Falha ao listar usuários: ${result.error.message}`);
      }
      const found = result.data.users.find(matchesAccountEmail);
      if (found === undefined) {
        throw new Error(
          `Não foi possível criar nem achar a conta ${ACCOUNT_EMAIL}: ${createError?.message}`,
        );
      }
      return found.id;
    },
  );
}

function matchesAccountEmail(user: { email?: string }): boolean {
  return user.email === ACCOUNT_EMAIL;
}

function findTrainerId(ctx: SeedContext): Promise<string | null> {
  const query = ctx.admin
    .from('trainers')
    .select('id')
    .eq('owner_id', ctx.ownerId)
    .eq('normalized_name', TRAINER_NORMALIZED_NAME)
    .maybeSingle();
  return Promise.resolve(query).then(function readTrainer(result: {
    data: { id: string } | null;
    error: { message: string } | null;
  }): string | null {
    if (result.error !== null) {
      throw new Error(`Falha ao procurar o treinador de teste: ${result.error.message}`);
    }
    return result.data?.id ?? null;
  });
}

function createTrainer(ctx: SeedContext): Promise<string> {
  const starter = ctx.species.get(STARTER_SPECIES_SLUG);
  if (starter === undefined) {
    throw new Error('A espécie inicial "brasa" não está no catálogo.');
  }
  const args = {
    p_gender: 'male',
    p_name: TRAINER_NAME,
    p_normalized_name: TRAINER_NORMALIZED_NAME,
    p_owner_id: ctx.ownerId,
    p_starter_species_id: starter.id,
  };
  return Promise.resolve(ctx.admin.rpc('create_trainer_with_starter', args)).then(
    function readCreated(result: { data: unknown; error: { message: string } | null }): string {
      if (result.error !== null) {
        throw new Error(`Falha ao criar o treinador: ${result.error.message}`);
      }
      const created = result.data as { trainer_id: string };
      return created.trainer_id;
    },
  );
}

function insertSeed(ctx: SeedContext, seeds: CreatureSeed[], index: number): Promise<SeedContext> {
  const seed = seeds[index];
  if (seed === undefined) {
    return Promise.resolve(ctx);
  }
  const speciesRow = ctx.species.get(seed.speciesSlug);
  if (speciesRow === undefined) {
    throw new Error(`A espécie "${seed.speciesSlug}" não está no catálogo.`);
  }
  const query = ctx.admin
    .from('creatures')
    .insert({
      experience: 0,
      is_in_team: false,
      level: 1,
      nickname: seed.nickname,
      potential: seed.potential,
      species_id: speciesRow.id,
      trainer_id: ctx.trainerId,
    })
    .select('id')
    .single();
  return Promise.resolve(query).then(function inserted(result: {
    data: { id: string } | null;
    error: { message: string } | null;
  }): Promise<SeedContext> {
    if (result.error !== null) {
      throw new Error(`Falha ao criar a criatura ${seed.nickname}: ${result.error.message}`);
    }
    const created = result.data;
    if (created === null) {
      throw new Error(`Falha ao criar a criatura ${seed.nickname}: resposta vazia.`);
    }
    const creatureIds = [...ctx.creatureIds, created.id];
    return insertSeed({ ...ctx, creatureIds }, seeds, index + 1);
  });
}

function addCreatureToTeam(
  ctx: SeedContext,
  creatureIds: string[],
  index: number,
): Promise<SeedContext> {
  const creatureId = creatureIds[index];
  if (creatureId === undefined) {
    return Promise.resolve(ctx);
  }
  const args = {
    p_creature_id: creatureId,
    p_owner_id: ctx.ownerId,
    p_trainer_id: ctx.trainerId,
  };
  return Promise.resolve(ctx.admin.rpc('add_creature_to_team', args)).then(function added(result: {
    error: { message: string } | null;
  }): Promise<SeedContext> {
    if (result.error !== null) {
      throw new Error(`Falha ao pôr a criatura ${creatureId} no time: ${result.error.message}`);
    }
    return addCreatureToTeam(ctx, creatureIds, index + 1);
  });
}

function mapTeamRow(row: TeamRow): TeamEntry {
  const relation = row.species as { name: string } | { name: string }[];
  const species = Array.isArray(relation) ? (relation[0]?.name ?? '') : relation.name;
  return { nickname: row.nickname ?? '', slot: row.team_slot ?? 0, species };
}
