import type { GameCommand } from '@creatures/contracts/game';
import type { PlayerState } from '@creatures/contracts/player';
import type { Tile } from '@creatures/contracts/world';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { openGameChannel } from '~/pages/play/model/gameChannel';
import type { GameChannelController } from '~/pages/play/model/gameChannel';
import type { CommandResult, MoveResult } from '~/pages/play/model/gameProtocol';
import type { PlayerStateLoadResult } from '~/pages/play/model/usePlayerState';

const CONNECTION_WARNING = 'A conexão com o servidor está indisponível.';
const TRAINERS_PATH = '/trainers';
const CLOSED_CHANNEL_MESSAGE = 'A conexão com o servidor não está aberta.';

export type GameChannel = {
  cancelExpectedClose: () => void;
  connectionLost: boolean;
  expectServerClose: () => void;
  onReconnect: () => void;
  /** Sends a command of the player to the server. */
  requestCommand: (command: GameCommand, reqId?: string) => Promise<CommandResult>;
  /** Sends the move of the player to the server. */
  requestMove: (target: Tile, reqId?: string) => Promise<MoveResult>;
};

export type GameChannelOptions = {
  applySnapshot: (state: PlayerState) => void;
  navigate: NavigateFunction;
  onWarning: (message: string) => void;
  refresh: () => Promise<PlayerStateLoadResult>;
  state: PlayerState | null;
};

type ChannelHandlers = {
  applySnapshot: (state: PlayerState) => void;
  onLost: () => void;
  onOpen: () => void;
  onWarning: (message: string) => void;
};

/**
 * The channel of updates of the game.
 *
 * The channel opens with the trainer of the player and closes with the screen.
 * When it falls, the channel opens itself again with a backoff: the player
 * leaves the tab open for hours, and the game cannot ask for a click to come
 * back. The button of the screen opens it right away.
 */
export function useGameChannel(options: GameChannelOptions): GameChannel {
  const { applySnapshot, navigate, onWarning, refresh, state } = options;
  const [connectionLost, setConnectionLost] = useState(false);
  const controllerRef = useRef<GameChannelController | null>(null);
  const openedRef = useRef(false);
  const trainerId = state === null ? null : state.trainer.id;
  const handlers = useLatestHandlers(
    buildChannelHandlers(applySnapshot, navigate, onWarning, refresh, setConnectionLost, openedRef),
  );

  useEffect(openChannel(handlers, trainerId, controllerRef), [handlers, trainerId]);

  return {
    cancelExpectedClose: buildExpectation(controllerRef, false),
    connectionLost,
    expectServerClose: buildExpectation(controllerRef, true),
    onReconnect: buildReconnect(controllerRef, refresh, navigate, onWarning),
    requestCommand: buildCommandRequester(controllerRef),
    requestMove: buildMoveRequester(controllerRef),
  };
}

/**
 * The handlers of the channel, with the life of the connection.
 */
function buildChannelHandlers(
  applySnapshot: (state: PlayerState) => void,
  navigate: NavigateFunction,
  onWarning: (message: string) => void,
  refresh: () => Promise<PlayerStateLoadResult>,
  setConnectionLost: (lost: boolean) => void,
  openedRef: RefObject<boolean>,
): ChannelHandlers {
  return {
    applySnapshot,
    onLost: function onLost(): void {
      setConnectionLost(true);
    },
    onOpen: function onOpen(): void {
      setConnectionLost(false);
      if (!openedRef.current) {
        openedRef.current = true;
        return;
      }
      // The channel opened again: the state that the player had is old, and
      // the server has the truth.
      refresh().then(handleRefreshResult(navigate, onWarning));
    },
    onWarning,
  };
}

/**
 * Opens the channel and hands its controller over to the screen.
 */
function openChannel(
  handlers: ChannelHandlers,
  trainerId: string | null,
  controllerRef: RefObject<GameChannelController | null>,
): () => void {
  return function open(): () => void {
    const controller = openGameChannel({
      applySnapshot: handlers.applySnapshot,
      onLost: handlers.onLost,
      onOpen: handlers.onOpen,
      onWarning: handlers.onWarning,
      trainerId,
    });
    controllerRef.current = controller;
    return function close(): void {
      controller.close();
      controllerRef.current = null;
    };
  };
}

/**
 * The button of the screen: it opens the channel right away, without waiting
 * for the backoff, and asks for the state that the player is missing.
 */
function buildReconnect(
  controllerRef: RefObject<GameChannelController | null>,
  refresh: () => Promise<PlayerStateLoadResult>,
  navigate: NavigateFunction,
  onWarning: (message: string) => void,
): () => void {
  return function onReconnect(): void {
    const controller = controllerRef.current;
    controller?.reconnectNow();
    refresh().then(handleRefreshResult(navigate, onWarning));
  };
}

/**
 * The move of the player, through the channel that is open.
 */
function buildMoveRequester(
  controllerRef: RefObject<GameChannelController | null>,
): (target: Tile, reqId?: string) => Promise<MoveResult> {
  return function requestMove(target: Tile, reqId?: string): Promise<MoveResult> {
    const controller = controllerRef.current;
    if (controller === null) {
      return Promise.reject(new Error(CLOSED_CHANNEL_MESSAGE));
    }
    return controller.requestMove(target, reqId);
  };
}

/**
 * A command of the player, through the channel that is open.
 */
function buildCommandRequester(
  controllerRef: RefObject<GameChannelController | null>,
): (command: GameCommand, reqId?: string) => Promise<CommandResult> {
  return function requestCommand(command: GameCommand, reqId?: string): Promise<CommandResult> {
    const controller = controllerRef.current;
    if (controller === null) {
      return Promise.reject(new Error(CLOSED_CHANNEL_MESSAGE));
    }
    return controller.requestCommand(command, reqId);
  };
}

/**
 * The close of the server that the player asked for, and the one that the
 * player did not.
 */
function buildExpectation(
  controllerRef: RefObject<GameChannelController | null>,
  expected: boolean,
): () => void {
  return function expect(): void {
    const controller = controllerRef.current;
    if (controller === null) {
      return;
    }
    if (expected) {
      controller.expectServerClose();
      return;
    }
    controller.cancelExpectedClose();
  };
}

/**
 * The handlers of the channel, always the latest one.
 *
 * The screen recreates its handlers on every render. The channel is opened
 * once and lives for the whole screen, so it cannot depend on their identity:
 * it reads them through a ref, and the wrapper it holds stays the same.
 */
function useLatestHandlers(handlers: ChannelHandlers): ChannelHandlers {
  const ref = useRef<ChannelHandlers>(handlers);
  const [stable] = useState<ChannelHandlers>(buildInitialHandlers(ref));
  useEffect(updateRef(ref, handlers), [handlers]);
  return stable;
}

function buildInitialHandlers(ref: RefObject<ChannelHandlers>): ChannelHandlers {
  return buildRefHandlers(ref);
}

function updateRef(ref: RefObject<ChannelHandlers>, handlers: ChannelHandlers): () => void {
  return function update(): void {
    ref.current = handlers;
  };
}

function buildRefHandlers(ref: RefObject<ChannelHandlers>): ChannelHandlers {
  return {
    applySnapshot: function applyThroughRef(state: PlayerState): void {
      ref.current.applySnapshot(state);
    },
    onLost: function loseThroughRef(): void {
      ref.current.onLost();
    },
    onOpen: function openThroughRef(): void {
      ref.current.onOpen();
    },
    onWarning: function warnThroughRef(message: string): void {
      ref.current.onWarning(message);
    },
  };
}

function handleRefreshResult(
  navigate: NavigateFunction,
  onWarning: (message: string) => void,
): (result: PlayerStateLoadResult) => void {
  return function handleResult(result: PlayerStateLoadResult): void {
    if (result === 'no-trainer') {
      navigate(TRAINERS_PATH, { replace: true });
      return;
    }
    if (result === 'failed') {
      onWarning(CONNECTION_WARNING);
    }
  };
}
