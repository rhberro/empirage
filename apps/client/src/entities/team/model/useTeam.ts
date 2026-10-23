import type { PlayerState } from '@creatures/contracts/player';
import { useCallback, useEffect, useMemo } from 'react';

import {
  requestAddToTeam,
  requestReleaseCreature,
  requestRemoveFromTeam,
  requestReorderTeam,
} from '~/entities/team/api/team';
import { awaitStateAfterCommand, readAppliedRevision } from '~/entities/team/model/playerStateSync';
import { readTeamErrorMessage } from '~/entities/team/model/team.messages';
import type {
  TeamCommand,
  TeamCommandResult,
  TeamErrorCode,
  TeamRoster,
  TeamView,
} from '~/entities/team/model/team.types';
import { applyCommands } from '~/entities/team/model/teamPrediction';
import { readRoster } from '~/entities/team/model/teamRoster';
import { teamStore, useTeamState } from '~/entities/team/model/teamStore';
import type { TeamStoreState } from '~/entities/team/model/teamStore';
import type { ApiDeps } from '~/shared/api';
import { createApiDeps } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

/**
 * How long a local change waits for the confirmation of the server.
 *
 * A change that is never confirmed is a change the server did not accept: the
 * client goes back to the state it has.
 */
const PENDING_EXPIRY_MS = 8000;

/**
 * The team of the player, as the game screens read it.
 *
 * The team is the state of the server plus the change the client predicts: the
 * creature enters the team in the same instant of the click, and the state the
 * server pushes takes the place of the prediction when it arrives. The team
 * never reads the state on its own: the state of the player is read once, and
 * everyone follows the same one.
 *
 * `enabled` keeps the hook from answering while the screen that asks for it
 * is closed, and the optional `deps` lets a test point the transport
 * somewhere else.
 */
export function useTeam(deps?: ApiDeps, enabled = true): TeamView {
  const resolvedDeps = useTeamDeps(deps);
  const commands = useTeamState(selectCommands);
  const error = useTeamState(selectError);
  const isLoading = useTeamState(selectIsLoading);
  const state = useTeamState(selectState);
  const roster = useMemo(
    function predict(): TeamRoster {
      return applyCommands(readRoster(state), commands);
    },
    [commands, state],
  );
  useTeamExpiry(commands);
  const teamCommands = useTeamCommands(resolvedDeps);
  if (!enabled) {
    return CLOSED_VIEW;
  }
  return {
    activeCreatureId: state?.activeCreatureId ?? null,
    addToTeam: teamCommands.addToTeam,
    backpack: state?.backpack ?? [],
    error: readTeamErrorMessage(error),
    isLoading,
    releaseCreature: teamCommands.releaseCreature,
    removeFromTeam: teamCommands.removeFromTeam,
    reorderTeam: teamCommands.reorderTeam,
    storage: roster.storage,
    team: roster.team,
  };
}

/**
 * The team of a screen that is closed.
 *
 * The screen that is closed shows nothing, and the commands it offers are
 * commands that nobody asked for.
 */
const CLOSED_VIEW: TeamView = {
  activeCreatureId: null,
  addToTeam: noopCommand,
  backpack: [],
  error: null,
  isLoading: false,
  releaseCreature: noopCommand,
  removeFromTeam: noopCommand,
  reorderTeam: noopCommand,
  storage: [],
  team: [],
};

/**
 * A change that the server never confirms is a change the server refused.
 */
function useTeamExpiry(commands: TeamCommand[]): void {
  useEffect(
    function schedule(): () => void {
      if (commands.length === 0) {
        return noop;
      }
      const timer = setTimeout(function expire(): void {
        teamStore.getState().clearCommands();
      }, PENDING_EXPIRY_MS);
      return function cancel(): void {
        clearTimeout(timer);
      };
    },
    [commands],
  );
}

type TeamCommands = {
  addToTeam(creatureId: string): Promise<void>;
  releaseCreature(creatureId: string): Promise<void>;
  removeFromTeam(creatureId: string): Promise<void>;
  reorderTeam(order: string[]): Promise<void>;
};

/**
 * The three commands that change the team.
 *
 * Every one of them predicts the change in the same instant of the click and
 * sends the command to the server. The prediction is what the screen shows
 * while the command is on its way; the state the server pushes is what the
 * screen shows after.
 */
function useTeamCommands(deps: ApiDeps): TeamCommands {
  const addToTeam = useCallback(
    function addToTeam(creatureId: string): Promise<void> {
      const command: TeamCommand = { creatureId, kind: 'add' };
      const expectedRev = readAppliedRevision();
      teamStore.getState().addCommand(command);
      return requestAddToTeam(deps, creatureId).then(handleCommandResult(command, expectedRev));
    },
    [deps],
  );

  const removeFromTeam = useCallback(
    function removeFromTeam(creatureId: string): Promise<void> {
      const command: TeamCommand = { creatureId, kind: 'remove' };
      const expectedRev = readAppliedRevision();
      teamStore.getState().addCommand(command);
      return requestRemoveFromTeam(deps, creatureId).then(
        handleCommandResult(command, expectedRev),
      );
    },
    [deps],
  );

  const reorderTeam = useCallback(
    function reorderTeam(order: string[]): Promise<void> {
      const command: TeamCommand = { kind: 'reorder', order };
      const expectedRev = readAppliedRevision();
      teamStore.getState().addCommand(command);
      return requestReorderTeam(deps, order).then(handleCommandResult(command, expectedRev));
    },
    [deps],
  );

  const releaseCreature = useCallback(
    function releaseCreature(creatureId: string): Promise<void> {
      const command: TeamCommand = { creatureId, kind: 'release' };
      const expectedRev = readAppliedRevision();
      teamStore.getState().addCommand(command);
      return requestReleaseCreature(deps, creatureId).then(
        handleCommandResult(command, expectedRev),
      );
    },
    [deps],
  );

  return { addToTeam, releaseCreature, removeFromTeam, reorderTeam };
}

/**
 * The answer of the server to a command of the team.
 *
 * A refused command takes the prediction back: the team of the server shows
 * again, and the message of the refusal goes to the screen. An accepted
 * command waits for the state that confirms it, and asks for the state when
 * the state does not come.
 */
function handleCommandResult(
  command: TeamCommand,
  expectedRev: number,
): (result: TeamCommandResult) => void {
  return function handleResult(result: TeamCommandResult): void {
    if (!result.ok) {
      const store = teamStore.getState();
      store.removeCommand(command);
      store.setError(result.code);
      return;
    }
    void awaitStateAfterCommand(expectedRev);
  };
}

/**
 * One deps object for the life of the hook.
 *
 * The deps hold the base URL and the token reader, neither of which changes:
 * building a new object every render would rebuild the effect every render.
 */
function useTeamDeps(deps?: ApiDeps): ApiDeps {
  const fallback = useMemo(function buildFallback(): ApiDeps {
    return createApiDeps(getAccessToken);
  }, []);
  return deps ?? fallback;
}

function selectCommands(state: TeamStoreState): TeamCommand[] {
  return state.commands;
}

function selectError(state: TeamStoreState): TeamErrorCode | null {
  return state.error;
}

function selectIsLoading(state: TeamStoreState): boolean {
  return state.isLoading;
}

function selectState(state: TeamStoreState): PlayerState | null {
  return state.state;
}

function noop(): void {
  void 0;
}

function noopCommand(): Promise<void> {
  return Promise.resolve();
}
