import type { HuntEndReason, HuntSession } from '@creatures/contracts/huntSession';

import type { HuntAreaContent } from '~/hunt/content';
import type { SimState, SimTeamMemberInput } from '~/hunt/sim';
import type { HuntTeamLoad } from '~/hunt/teamMappers';

import type { HuntRuntime } from './types';

/**
 * Builds the runtime of a hunt from the session and the simulation state.
 */
export function buildRuntime(input: {
  accountId: string;
  area: HuntAreaContent;
  session: HuntSession;
  staminaAtStart: number;
  startedAt: number;
  state: SimState;
  windowEndReason: HuntRuntime['windowEndReason'];
}): HuntRuntime {
  const { accountId, area, session, staminaAtStart, startedAt, state, windowEndReason } = input;
  return {
    accountId,
    areaId: area.areaId,
    areaName: area.areaName,
    areaSlug: area.areaSlug,
    checkpointing: false,
    content: area.content,
    credited: { drops: {}, spent: {} },
    delivered: {
      abilities: '',
      actors: new Map<string, string>(),
      consumables: '',
      device: '',
      ledger: '',
      team: '',
      trainer: '',
      waves: '',
    },
    dirty: false,
    endsAt: state.endsAt,
    huntRev: 0,
    lastCheckpointAt: startedAt,
    lastWildIds: state.wilds.map(readCreatureId),
    pendingCheckpoint: null,
    sessionId: session.id,
    sideEffects: Promise.resolve(),
    staminaAtStart,
    startedAt,
    state,
    trainerId: session.trainerId,
    version: 0,
    windowEndReason,
  };
}

/**
 * Why the hunt is closing.
 *
 * The simulation labels the end of the window as an offline session because it
 * does not know the stamina rule; the runtime does know which of the two limits
 * came first, so it corrects the label.
 */
export function readCloseReason(runtime: HuntRuntime, requested: HuntEndReason): HuntEndReason {
  if (runtime.state.endReason === null) {
    return requested;
  }
  if (
    runtime.state.endReason === 'offline_session_expired' &&
    runtime.windowEndReason === 'stamina_depleted'
  ) {
    return 'stamina_depleted';
  }
  return runtime.state.endReason;
}

export function readTeamSpeciesSlugs(teamLoad: HuntTeamLoad): string[] {
  return readMemberSpeciesSlugs(teamLoad.team);
}

export function readStateSpeciesSlugs(state: SimState | null): string[] {
  return state === null ? [] : readMemberSpeciesSlugs(state.team);
}

export function hasViableMember(team: SimTeamMemberInput[]): boolean {
  for (const member of team) {
    if (member.currentHp === null || member.currentHp > 0) {
      return true;
    }
  }
  return false;
}

export function addCredited(
  credited: Record<string, number>,
  itemId: string,
  quantity: number,
): void {
  credited[itemId] = (credited[itemId] ?? 0) + quantity;
}

export function readCreatureId(creature: { id: string }): string {
  return creature.id;
}

function readMemberSpeciesSlugs(team: { speciesSlug: string }[]): string[] {
  const slugs: string[] = [];
  for (const member of team) {
    if (!slugs.includes(member.speciesSlug)) {
      slugs.push(member.speciesSlug);
    }
  }
  return slugs;
}
