import type { HuntSnapshot } from '@creatures/contracts/huntSim';

import type { HuntAreaContent } from '~/hunt/content';
import { loadHuntAreaContent, loadHuntTeam, loadHuntTrainer } from '~/hunt/content';
import { HuntStartError } from '~/hunt/errors';
import { createHuntSeed } from '~/hunt/rng';
import { canStartHunt, readHuntRules, resolveHuntRuleEnd } from '~/hunt/rules';
import { saveHuntSimulation } from '~/hunt/runtime/persistence';
import { toSnapshot } from '~/hunt/runtime/wire';
import { readActiveHuntSession, startHuntSession } from '~/hunt/session';
import type { SimDevice, SimTeamMemberInput } from '~/hunt/sim';
import { createHuntState } from '~/hunt/sim';

import { advanceNow } from './advance';
import { buildRuntime, hasViableMember, readTeamSpeciesSlugs } from './runtime';
import type { HuntManagerState } from './state';
import type { HuntManager } from './types';

/**
 * The content the account rules are read from while the account type is not
 * persisted in the catalog.
 *
 * Both the offline session of the free account (four hours) and the paid one
 * (eight hours) are already in the contract; the row that says which one a
 * trainer belongs to does not exist yet, so a hunt is always free.
 */
const HUNT_ACCOUNT_TYPE = 'free';

type StartContext = {
  area: HuntAreaContent;
  device: SimDevice | null;
  staminaAtStart: number;
  team: SimTeamMemberInput[];
};

/**
 * The start of a hunt, serialized with the other operations of the trainer.
 */
export function buildStart(state: HuntManagerState): HuntManager['start'] {
  return function start(input: {
    accountId: string;
    areaId: string;
    trainerId: string;
  }): Promise<HuntSnapshot> {
    return state.enqueue(input.trainerId, function startTask(): Promise<HuntSnapshot> {
      return startNow(state, input);
    });
  };
}

function startNow(
  state: HuntManagerState,
  input: { accountId: string; areaId: string; trainerId: string },
): Promise<HuntSnapshot> {
  if (state.runtimes.has(input.trainerId)) {
    return Promise.reject(new HuntStartError('already_hunting'));
  }
  return readActiveHuntSession(state.admin, input.trainerId)
    .then(function withOpenSession(
      open: Awaited<ReturnType<typeof readActiveHuntSession>>,
    ): Promise<StartContext> {
      if (open !== null) {
        throw new HuntStartError('already_hunting');
      }
      return readStartContext(state, input);
    })
    .then(function create(context: StartContext): Promise<HuntSnapshot> {
      return createHunt(state, input, context);
    });
}

function readStartContext(
  state: HuntManagerState,
  input: { accountId: string; areaId: string; trainerId: string },
): Promise<StartContext> {
  return Promise.all([
    loadHuntTeam(state.admin, input.trainerId),
    loadHuntTrainer(state.admin, input.trainerId),
  ]).then(function withTeam(
    reads: [Awaited<ReturnType<typeof loadHuntTeam>>, Awaited<ReturnType<typeof loadHuntTrainer>>],
  ): Promise<StartContext> {
    const [teamLoad, trainer] = reads;
    if (trainer === null) {
      throw new Error(`Trainer ${input.trainerId} was not found`);
    }
    return loadHuntAreaContent(state.admin, input.areaId, readTeamSpeciesSlugs(teamLoad)).then(
      function withArea(area: HuntAreaContent): StartContext {
        if (trainer.level < area.minimumLevel) {
          throw new HuntStartError('level_too_low');
        }
        if (!canStartHunt(teamLoad.staminaMinutes)) {
          throw new HuntStartError('stamina_insufficient');
        }
        if (!hasViableMember(teamLoad.team)) {
          throw new HuntStartError('no_viable_creature');
        }
        return {
          area,
          device: teamLoad.device,
          staminaAtStart: teamLoad.staminaMinutes,
          team: teamLoad.team,
        };
      },
    );
  });
}

function createHunt(
  state: HuntManagerState,
  input: { accountId: string; areaId: string; trainerId: string },
  context: StartContext,
): Promise<HuntSnapshot> {
  const seed = createHuntSeed();
  const startedAt = state.now();
  const ruleEnd = resolveHuntRuleEnd({
    offlineSessionMinutes: readHuntRules(HUNT_ACCOUNT_TYPE).offlineSessionMinutes,
    staminaAtStart: context.staminaAtStart,
    startedAt,
  });
  const simulation = createHuntState({
    areaSlug: context.area.areaSlug,
    content: context.area.content,
    device: context.device,
    endsAt: ruleEnd.endsAt,
    rngDraws: 0,
    seed,
    startedAt,
    team: context.team,
  });
  return startHuntSession(state.admin, {
    accountId: input.accountId,
    huntAreaId: input.areaId,
    rngSeed: seed,
    staminaAtStart: context.staminaAtStart,
    startedAt,
    trainerId: input.trainerId,
  }).then(function withSession(
    session: Awaited<ReturnType<typeof startHuntSession>>,
  ): Promise<HuntSnapshot> {
    return persistHunt(state, input, context, simulation, ruleEnd.reason, startedAt, session);
  });
}

function persistHunt(
  state: HuntManagerState,
  input: { accountId: string; areaId: string; trainerId: string },
  context: StartContext,
  simulation: ReturnType<typeof createHuntState>,
  windowEndReason: Parameters<typeof buildRuntime>[0]['windowEndReason'],
  startedAt: number,
  session: Awaited<ReturnType<typeof startHuntSession>>,
): Promise<HuntSnapshot> {
  const runtime = buildRuntime({
    accountId: input.accountId,
    area: context.area,
    session,
    staminaAtStart: context.staminaAtStart,
    startedAt,
    state: simulation,
    windowEndReason,
  });
  state.runtimes.set(input.trainerId, runtime);
  return saveHuntSimulation(state.admin, session.id, simulation, startedAt).then(
    function saved(): Promise<HuntSnapshot> {
      const snapshot = toSnapshot(runtime, state.now());
      state.deps.onSnapshot?.(input.accountId, input.trainerId, snapshot);
      // The first instant of the hunt is the start itself: process it now so
      // the first step is on the wire with the snapshot, instead of waiting
      // for the first decision of a wild.
      return advanceNow(state, input.trainerId).then(function bootstrapped(): HuntSnapshot {
        return snapshot;
      });
    },
    function failed(error: unknown): never {
      state.runtimes.delete(input.trainerId);
      throw error;
    },
  );
}
