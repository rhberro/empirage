import type { PlayerState } from '@creatures/contracts/player';

import { decideRevision } from './playerStateRevision';
import { playerStateSync } from './playerStateSync';
import type { PlayerStateSource } from './playerStateSync';
import type { TeamCommand, TeamRoster } from './team.types';
import { satisfiesCommand } from './teamPrediction';
import { readRoster } from './teamRoster';

/**
 * The part of the team that a state of the player changes.
 */
export type TeamStateSnapshot = {
  /** The changes of the team that are on their way to the server. */
  commands: TeamCommand[];
  /** The boot of the server that produced the state that is applied. */
  epoch: string | null;
  /** Whether the state of the server ever arrived. */
  isLoaded: boolean;
  /** Whether the state of the server is being read. */
  isLoading: boolean;
  /** Whether the channel of the game carries the state of the server. */
  isPushed: boolean;
  /** The revision of the state that is applied. */
  rev: number;
  /** The state of the server, the truth the predictions are built on. */
  state: PlayerState | null;
};

/**
 * The store that the state is written to.
 */
export type TeamStateWriter = {
  get(): TeamStateSnapshot;
  set(partial: Partial<TeamStateSnapshot>): void;
};

/**
 * The application of a state, guarded by the revision.
 *
 * A state that is not newer than the one the client has is ignored: the
 * server pushes the state that changes, and a push that arrives late does not
 * put the client back in the past. A state of another epoch is a resync: the
 * server restarted, and the client takes what came.
 */
export function applyTeamState(
  writer: TeamStateWriter,
  state: PlayerState,
  source: PlayerStateSource,
  publish: boolean,
): void {
  const current = writer.get();
  const decision = decideRevision(readRevision(current), { epoch: state.epoch, rev: state.rev });
  if (decision === 'ignore') {
    return;
  }
  const roster = readRoster(state);
  const partial: Partial<TeamStateSnapshot> = {
    commands: readPendingCommands(current.commands, roster),
    epoch: state.epoch,
    isLoaded: true,
    isLoading: false,
    rev: state.rev,
    state,
  };
  if (source === 'push') {
    partial.isPushed = true;
  }
  writer.set(partial);
  if (publish) {
    playerStateSync.publish(state, source);
  }
}

/**
 * The changes that the state of the server does not carry yet.
 *
 * A change that the state already carries is confirmed: the server did it,
 * and the client has nothing left to predict.
 */
function readPendingCommands(commands: TeamCommand[], roster: TeamRoster): TeamCommand[] {
  return commands.filter(function keepPending(command: TeamCommand): boolean {
    return !satisfiesCommand(roster, command);
  });
}

function readRevision(state: TeamStateSnapshot): { epoch: string; rev: number } | null {
  if (state.epoch === null) {
    return null;
  }
  return { epoch: state.epoch, rev: state.rev };
}
