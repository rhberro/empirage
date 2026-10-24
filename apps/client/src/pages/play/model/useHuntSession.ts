import type { GameCommand } from '@creatures/contracts/game';

import type { HuntPhase } from '~/entities/hunt';
import {
  huntStore,
  selectHasSnapshot,
  selectHuntError,
  selectHuntPhase,
  useHuntState,
} from '~/entities/hunt';
import type { CommandResult } from '~/pages/play/model/gameProtocol';
import { createApiDeps, requestStartHunt } from '~/shared/api';
import type { HuntStartResult, TrainerClientErrorCode } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

const START_FAILURE_MESSAGE = 'Não foi possível iniciar a caçada.';
const FINALIZE_FAILURE_MESSAGE = 'Não foi possível finalizar a caçada.';

export type HuntCommandChannel = {
  requestCommand(command: GameCommand, reqId?: string): Promise<CommandResult>;
};

export type HuntSessionView = {
  error: string | null;
  finalizeHunt: () => Promise<boolean>;
  hasSnapshot: boolean;
  phase: HuntPhase;
  requestCommand: (command: GameCommand, reqId?: string) => Promise<CommandResult>;
  startHunt: (areaId: string) => Promise<boolean>;
};

/**
 * The hunt of the screen: the store, the start and the exit.
 *
 * The hunt state lives in the store; this hook connects it to the command
 * channel and to the REST routes, and turns every failure into a message for
 * the player.
 */
export function useHuntSession(
  channel: HuntCommandChannel,
  notify: (message: string) => void,
): HuntSessionView {
  const phase = useHuntState(selectHuntPhase);
  const hasSnapshot = useHuntState(selectHasSnapshot);
  const error = useHuntState(selectHuntError);
  return {
    error,
    finalizeHunt: buildFinalizeHunt(channel, notify),
    hasSnapshot,
    phase,
    requestCommand: channel.requestCommand,
    startHunt: buildStartHunt(notify),
  };
}

function buildStartHunt(notify: (message: string) => void): (areaId: string) => Promise<boolean> {
  return function startHunt(areaId: string): Promise<boolean> {
    huntStore.getState().beginEntering();
    return requestStartHunt(createApiDeps(getAccessToken), areaId).then(
      function handleStart(result: HuntStartResult): boolean {
        if (!result.ok) {
          failStart(result.code, notify);
          return false;
        }
        huntStore.getState().applySnapshot(result.snapshot);
        return true;
      },
      function handleFailure(): boolean {
        failStart('unknown', notify);
        return false;
      },
    );
  };
}

function buildFinalizeHunt(
  channel: HuntCommandChannel,
  notify: (message: string) => void,
): () => Promise<boolean> {
  return function finalizeHunt(): Promise<boolean> {
    return channel.requestCommand({ type: 'finalize_hunt' }).then(
      function handleAnswer(result: CommandResult): boolean {
        if (!result.ok) {
          failFinalize(notify);
          return false;
        }
        return true;
      },
      function handleFailure(): boolean {
        failFinalize(notify);
        return false;
      },
    );
  };
}

function failStart(code: TrainerClientErrorCode, notify: (message: string) => void): void {
  const message = readStartMessage(code);
  huntStore.getState().resetHunt();
  huntStore.getState().setError(message);
  notify(message);
}

function failFinalize(notify: (message: string) => void): void {
  huntStore.getState().setError(FINALIZE_FAILURE_MESSAGE);
  notify(FINALIZE_FAILURE_MESSAGE);
}

function readStartMessage(code: TrainerClientErrorCode): string {
  if (code === 'unauthenticated') {
    return 'A sessão expirou. Entre novamente para caçar.';
  }
  if (code === 'trainer_not_found') {
    return 'O treinador não foi encontrado.';
  }
  if (code === 'rate_limited') {
    return 'Muitas tentativas. Tente novamente em alguns minutos.';
  }
  return START_FAILURE_MESSAGE;
}
