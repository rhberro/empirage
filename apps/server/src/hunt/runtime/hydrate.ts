import type { HuntEndReason, HuntSession } from '@creatures/contracts/huntSession';
import type { HuntSnapshot } from '@creatures/contracts/huntSim';

import type { HuntAreaContent } from '~/hunt/content';
import { loadHuntAreaContent, loadHuntTeam } from '~/hunt/content';
import { readHuntRules, resolveHuntRuleEnd } from '~/hunt/rules';
import { readHuntSimulation } from '~/hunt/runtime/persistence';
import { toSnapshot } from '~/hunt/runtime/wire';
import { listActiveHuntSessionsBehind } from '~/hunt/session';
import type { SimState } from '~/hunt/sim';
import { advanceUntil, createHuntState } from '~/hunt/sim';
import type { HuntTeamLoad } from '~/hunt/teamMappers';

import { closeHunt } from './close';
import {
  buildRuntime,
  readCreatureId,
  readStateSpeciesSlugs,
  readTeamSpeciesSlugs,
} from './runtime';
import type { HuntManagerState } from './state';
import type { HuntManager } from './types';

/**
 * The account type the window rules are read from while the catalog does not
 * persist it.
 */
const HUNT_ACCOUNT_TYPE = 'free';

type HydrateContext = {
  area: HuntAreaContent;
  stored: SimState | null;
  teamLoad: HuntTeamLoad | null;
};

/**
 * Resumes an open session, serialized with the other operations of the trainer.
 */
export function buildHydrate(state: HuntManagerState): HuntManager['hydrate'] {
  return function hydrate(session: HuntSession): Promise<void> {
    return state.enqueue(session.trainerId, function hydrateTask(): Promise<void> {
      return hydrateNow(state, session);
    });
  };
}

function hydrateNow(state: HuntManagerState, session: HuntSession): Promise<void> {
  if (state.runtimes.has(session.trainerId) || session.status !== 'active') {
    return Promise.resolve();
  }
  return readHuntSimulation(state.admin, session.id)
    .then(function withStored(stored: SimState | null): Promise<HydrateContext> {
      return readHydrateContext(state, session, stored);
    })
    .then(function restore(context: HydrateContext): Promise<void> {
      return restoreRuntime(state, session, context);
    });
}

function readHydrateContext(
  state: HuntManagerState,
  session: HuntSession,
  stored: SimState | null,
): Promise<HydrateContext> {
  const team =
    stored === null ? loadHuntTeam(state.admin, session.trainerId) : Promise.resolve(null);
  return team.then(function withTeam(teamLoad: HuntTeamLoad | null): Promise<HydrateContext> {
    const slugs =
      stored === null && teamLoad !== null
        ? readTeamSpeciesSlugs(teamLoad)
        : readStateSpeciesSlugs(stored);
    return loadHuntAreaContent(state.admin, session.huntAreaId, slugs).then(function withArea(
      area: HuntAreaContent,
    ): HydrateContext {
      return { area, stored, teamLoad };
    });
  });
}

function restoreRuntime(
  state: HuntManagerState,
  session: HuntSession,
  context: HydrateContext,
): Promise<void> {
  const ruleEnd = resolveHuntRuleEnd({
    offlineSessionMinutes: readHuntRules(HUNT_ACCOUNT_TYPE).offlineSessionMinutes,
    staminaAtStart: session.staminaAtStart,
    startedAt: session.startedAt,
  });
  const simulation =
    context.stored ??
    createHuntState({
      areaSlug: context.area.areaSlug,
      content: context.area.content,
      device: context.teamLoad?.device ?? null,
      endsAt: ruleEnd.endsAt,
      rngDraws: session.rngDraws,
      seed: session.rngSeed,
      startedAt: session.startedAt,
      team: context.teamLoad?.team ?? [],
    });
  normalizeStoredState(simulation);
  const runtime = buildRuntime({
    accountId: session.accountId,
    area: context.area,
    session,
    staminaAtStart: session.staminaAtStart,
    startedAt: session.startedAt,
    state: simulation,
    windowEndReason: ruleEnd.reason,
  });
  if (simulation.projectiles === undefined) {
    simulation.projectiles = [];
  }
  if (simulation.projectiles === undefined) {
    simulation.projectiles = [];
  }
  state.runtimes.set(session.trainerId, runtime);
  const at = state.now();
  const result = advanceUntil(simulation, at, context.area.content);
  runtime.lastWildIds = simulation.wilds.map(readCreatureId);
  runtime.lastCheckpointAt = at;
  runtime.dirty = result.events.length > 0;
  if (!simulation.ended) {
    state.scheduler?.arm(session.trainerId);
    return Promise.resolve();
  }
  return closeHunt(state, runtime, readEndReason(simulation));
}

function normalizeStoredState(state: SimState): void {
  // A checkpoint written before capture and devices existed has none of the
  // fields below; filling them keeps an old session resumable.
  if (state.device === undefined) {
    state.device = null;
  }
  if (state.projectiles === undefined) {
    state.projectiles = [];
  }
  for (let index = 0; index < state.team.length; index += 1) {
    const member = state.team[index];
    if (member !== undefined && member.teamSlot === undefined) {
      member.teamSlot = index + 1;
    }
  }
  for (const wild of state.wilds) {
    if (wild.captureAt === undefined) {
      wild.captureAt = null;
    }
  }
}

function readEndReason(state: SimState): HuntEndReason {
  return state.endReason ?? 'no_viable_creature';
}

/**
 * The boot sweep: every open session that is behind the cursor is resumed.
 */
export function buildSweep(state: HuntManagerState): HuntManager['sweep'] {
  return function sweep(): Promise<void> {
    return listActiveHuntSessionsBehind(state.admin, state.now()).then(function withSessions(
      sessions: HuntSession[],
    ): Promise<void> {
      return hydrateSequentially(state, sessions);
    });
  };
}

function hydrateSequentially(state: HuntManagerState, sessions: HuntSession[]): Promise<void> {
  let chain = Promise.resolve();
  for (const session of sessions) {
    chain = chain.then(buildHydrateStep(state, session));
  }
  return chain;
}

function buildHydrateStep(state: HuntManagerState, session: HuntSession): () => Promise<void> {
  return function hydrateOne(): Promise<void> {
    return state
      .enqueue(session.trainerId, function hydrateTask(): Promise<void> {
        return hydrateNow(state, session);
      })
      .catch(function logFailure(error: unknown): void {
        state.logger.error({ err: error, sessionId: session.id }, 'hunt hydrate failed');
      });
  };
}

/**
 * The snapshot of the hunt of a trainer.
 */
export function buildSnapshot(state: HuntManagerState): HuntManager['snapshot'] {
  return function snapshot(trainerId: string): Promise<HuntSnapshot | null> {
    // The read enters the same serial queue as the advances and the commands,
    // so a reconnect never sees a state that is half through a window.
    return state.enqueue(trainerId, function snapshotTask(): Promise<HuntSnapshot | null> {
      const runtime = state.runtimes.get(trainerId);
      if (runtime === undefined) {
        return Promise.resolve(null);
      }
      return Promise.resolve(toSnapshot(runtime, state.now()));
    });
  };
}
