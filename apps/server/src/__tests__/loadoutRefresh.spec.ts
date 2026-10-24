import { expect, test } from 'bun:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ServerDependencies } from '~/dependencies';

import {
  BAD_REQUEST,
  buildDependencies,
  buildHandler,
  buildJsonRequest,
  buildNoopHuntManager,
  buildRequest,
  NO_CONTENT,
  send,
  TRAINER_ID,
  USER_ID,
  USER_TOKEN,
} from './support';

const CREATURE_ID = '11111111-1111-4111-8111-111111111111';
const ABILITY_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const INVALID_COMMAND = { code: 'P0001', message: 'invalid_team_command' };

type RouteAdminOptions = {
  gearWriteError?: { code: string; message: string } | null;
  loadoutWriteError?: { code: string; message: string } | null;
};

type RefreshCalls = {
  count: number;
  trainerIds: string[];
};

function buildRouteAdmin(options?: RouteAdminOptions): SupabaseClient {
  const settings = options ?? {};
  return {
    from: function from(table: string): unknown {
      return buildTable(table, settings);
    },
    rpc: function rpc(): Promise<unknown> {
      return Promise.resolve({ data: null, error: settings.loadoutWriteError ?? null });
    },
  } as unknown as SupabaseClient;
}

const CREATURE_READ = {
  maybeSingle: function maybeSingle(): Promise<unknown> {
    return Promise.resolve({ data: { species_id: 'species-1' }, error: null });
  },
};
const CREATURE_TRAINER_FILTER = {
  eq: function eq(): unknown {
    return CREATURE_READ;
  },
};
const CREATURE_ID_FILTER = {
  eq: function eq(): unknown {
    return CREATURE_TRAINER_FILTER;
  },
};
const CREATURE_TABLE = {
  select: function select(): unknown {
    return CREATURE_ID_FILTER;
  },
};

const SPECIES_ABILITY_FILTER = {
  eq: function eq(): Promise<unknown> {
    return Promise.resolve({ data: [{ ability_id: ABILITY_ID }], error: null });
  },
};
const SPECIES_ABILITIES_TABLE = {
  select: function select(): unknown {
    return SPECIES_ABILITY_FILTER;
  },
};

const ITEM_READ = {
  maybeSingle: function maybeSingle(): Promise<unknown> {
    return Promise.resolve({ data: { category: 'consumable' }, error: null });
  },
};
const ITEM_FILTER = {
  eq: function eq(): unknown {
    return ITEM_READ;
  },
};
const ITEMS_TABLE = {
  select: function select(): unknown {
    return ITEM_FILTER;
  },
};

function buildTable(table: string, options: RouteAdminOptions): unknown {
  if (table === 'creatures') {
    return CREATURE_TABLE;
  }
  if (table === 'species_abilities') {
    return SPECIES_ABILITIES_TABLE;
  }
  if (table === 'items') {
    return ITEMS_TABLE;
  }
  if (table === 'trainer_gear_slots') {
    return buildGearTable(options);
  }
  throw new Error(`unexpected table ${table}`);
}

function buildGearTable(options: RouteAdminOptions): unknown {
  return {
    delete: function deleteQuery(): unknown {
      return buildGearDelete(options);
    },
    upsert: function upsert(): Promise<unknown> {
      return writeGear(options);
    },
  };
}

function buildGearDelete(options: RouteAdminOptions): unknown {
  return {
    eq: function eq(): unknown {
      return buildGearSecondFilter(options);
    },
  };
}

function buildGearSecondFilter(options: RouteAdminOptions): unknown {
  return {
    eq: function secondEq(): Promise<unknown> {
      return writeGear(options);
    },
  };
}

function writeGear(options: RouteAdminOptions): Promise<unknown> {
  return Promise.resolve({ data: null, error: options.gearWriteError ?? null });
}

type Harness = {
  calls: RefreshCalls;
  deps: ServerDependencies;
};

function buildRouteHarness(options?: RouteAdminOptions): Harness {
  const calls: RefreshCalls = { count: 0, trainerIds: [] };
  const hunts = buildNoopHuntManager({
    refreshLoadout: function refreshLoadout(trainerId: string): Promise<void> {
      calls.count += 1;
      calls.trainerIds.push(trainerId);
      return Promise.resolve();
    },
  });
  const deps = buildDependencies({ admin: buildRouteAdmin(options), hunts });
  deps.sessions.set(USER_ID, TRAINER_ID);
  return { calls, deps };
}

function writeAbilitySlots(harness: Harness): Promise<Response> {
  const request = buildJsonRequest(
    'PUT',
    `/api/creatures/${CREATURE_ID}/ability-slots`,
    { abilityIds: [ABILITY_ID, '', '', ''] },
    USER_TOKEN,
  );
  return send(buildHandler(harness.deps), request);
}

function writeGearSlot(harness: Harness): Promise<Response> {
  const request = buildJsonRequest(
    'PUT',
    '/api/gear-slots/4',
    { itemId: ITEM_ID, triggerHpPercent: 40 },
    USER_TOKEN,
  );
  return send(buildHandler(harness.deps), request);
}

function deleteGearSlot(harness: Harness): Promise<Response> {
  const request = buildRequest('DELETE', '/api/gear-slots/4', USER_TOKEN);
  return send(buildHandler(harness.deps), request);
}

function refreshesAfterTheAbilityWrite(): Promise<void> {
  const harness = buildRouteHarness();
  return writeAbilitySlots(harness).then(function assert(response: Response): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(harness.calls.trainerIds).toEqual([TRAINER_ID]);
  });
}

function doesNotRefreshAfterAFailedAbilityWrite(): Promise<void> {
  const harness = buildRouteHarness({ loadoutWriteError: INVALID_COMMAND });
  return writeAbilitySlots(harness).then(function assert(response: Response): void {
    expect(response.status).toBe(BAD_REQUEST);
    expect(harness.calls.count).toBe(0);
  });
}

function refreshesAfterTheGearWrite(): Promise<void> {
  const harness = buildRouteHarness();
  return writeGearSlot(harness).then(function assert(response: Response): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(harness.calls.trainerIds).toEqual([TRAINER_ID]);
  });
}

function doesNotRefreshAfterAFailedGearWrite(): Promise<void> {
  const harness = buildRouteHarness({ gearWriteError: INVALID_COMMAND });
  return writeGearSlot(harness).then(function assert(response: Response): void {
    expect(response.status).toBe(BAD_REQUEST);
    expect(harness.calls.count).toBe(0);
  });
}

function refreshesAfterTheGearDeletion(): Promise<void> {
  const harness = buildRouteHarness();
  return deleteGearSlot(harness).then(function assert(response: Response): void {
    expect(response.status).toBe(NO_CONTENT);
    expect(harness.calls.trainerIds).toEqual([TRAINER_ID]);
  });
}

function doesNotRefreshAfterAFailedGearDeletion(): Promise<void> {
  const harness = buildRouteHarness({ gearWriteError: INVALID_COMMAND });
  return deleteGearSlot(harness).then(function assert(response: Response): void {
    expect(response.status).toBe(BAD_REQUEST);
    expect(harness.calls.count).toBe(0);
  });
}

test('the ability slots refresh the hunt after the write', refreshesAfterTheAbilityWrite);
test('a failed ability write does not refresh the hunt', doesNotRefreshAfterAFailedAbilityWrite);
test('the gear slot refreshes the hunt after the write', refreshesAfterTheGearWrite);
test('a failed gear write does not refresh the hunt', doesNotRefreshAfterAFailedGearWrite);
test('the gear deletion refreshes the hunt', refreshesAfterTheGearDeletion);
test('a failed gear deletion does not refresh the hunt', doesNotRefreshAfterAFailedGearDeletion);
