import type { HuntDelta, HuntEndedMessage } from '@creatures/contracts/huntSim';
import type { ActorMedia, PathSegment } from '@creatures/contracts/world';

import type { HuntSnapshot } from '~/entities/hunt';
import type { CommandResult, MoveResult, WorldStateMessage } from '~/pages/play/model/gameProtocol';
import type { GameSocketHandlers } from '~/pages/play/model/gameSocket';

export const BASE_URL = 'https://api.example.com';
export const TICKET = 'ticket-123';
export const WAIT_MS = 30;

type Listener = (event: unknown) => void;

export type FakeSocket = {
  addEventListener: (type: string, listener: Listener) => void;
  close: () => void;
  listeners: Map<string, Listener[]>;
  readyState: number;
  send: (message: string) => void;
  sent: string[];
  url: string;
  emit(type: string, event?: unknown): void;
};

type FakeWebSocket = {
  new (url: string): globalThis.WebSocket;
  OPEN: number;
};

const OPEN = 1;

/**
 * The socket of the test: it records what the client sends and lets the test
 * play the events of the server.
 */
function buildFakeSocket(url: string): FakeSocket {
  const listeners = new Map<string, Listener[]>();
  const socket: FakeSocket = {
    addEventListener: function addEventListener(type: string, listener: Listener): void {
      const known = listeners.get(type) ?? [];
      known.push(listener);
      listeners.set(type, known);
    },
    close: function close(): void {
      socket.readyState = 3;
      socket.emit('close', { code: 1000 });
    },
    emit: function emit(type: string, event?: unknown): void {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    },
    listeners,
    readyState: OPEN,
    send: function send(message: string): void {
      socket.sent.push(message);
    },
    sent: [],
    url,
  };
  return socket;
}

export function installFakeSocket(): { sockets: FakeSocket[]; restore: () => void } {
  const sockets: FakeSocket[] = [];
  const original = globalThis.WebSocket;
  const Fake = function FakeSocket(url: string): globalThis.WebSocket {
    const socket = buildFakeSocket(url);
    sockets.push(socket);
    return socket as unknown as globalThis.WebSocket;
  } as unknown as FakeWebSocket;
  Fake.OPEN = OPEN;
  globalThis.WebSocket = Fake as unknown as typeof globalThis.WebSocket;
  return {
    restore: function restore(): void {
      globalThis.WebSocket = original;
    },
    sockets,
  };
}

export function waitFor(milliseconds: number): Promise<void> {
  return new Promise(function resolveLater(resolve: () => void): void {
    setTimeout(resolve, milliseconds);
  });
}

export function buildActor(actorId: string, x: number, y: number): ActorMedia {
  return { actorId, dir: 'down', gender: 'male', name: actorId, position: { x, y } };
}

export function buildSegment(fromX: number, toX: number): PathSegment {
  return {
    dir: 'right',
    endsAt: 1300,
    from: { x: fromX, y: 2 },
    startsAt: 1000,
    to: { x: toX, y: 2 },
  };
}

/**
 * The reason a promise was refused, read as a message.
 */
export function readRejection(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    function noRejection(): string {
      return '';
    },
    function onRejection(caught: unknown): string {
      return caught instanceof Error ? caught.message : '';
    },
  );
}

export type Handlers = {
  closed: number[];
  deltas: HuntDelta[];
  ended: HuntEndedMessage[];
  errors: string[];
  handlers: GameSocketHandlers;
  hunts: HuntSnapshot[];
  moved: MoveResult[];
  results: CommandResult[];
  worlds: WorldStateMessage[];
};

export function buildHandlers(): Handlers {
  const record: Handlers = {
    closed: [],
    deltas: [],
    ended: [],
    errors: [],
    handlers: {
      onActorLeave: noop,
      onActorUpdate: noop,
      onClose: function onClose(code: number): void {
        record.closed.push(code);
      },
      onCommandResult: function onCommandResult(result: CommandResult): void {
        record.results.push(result);
      },
      onError: function onError(message: string): void {
        record.errors.push(message);
      },
      onHuntDelta: function onHuntDelta(delta: HuntDelta): void {
        record.deltas.push(delta);
      },
      onHuntEnded: function onHuntEnded(ended: HuntEndedMessage): void {
        record.ended.push(ended);
      },
      onHuntState: function onHuntState(snapshot: HuntSnapshot): void {
        record.hunts.push(snapshot);
      },
      onMoveResult: function onMoveResult(result: MoveResult): void {
        record.moved.push(result);
      },
      onPong: noop,
      onState: noop,
      onStatus: noop,
      onWorldState: function onWorldState(world: WorldStateMessage): void {
        record.worlds.push(world);
      },
    },
    hunts: [],
    moved: [],
    results: [],
    worlds: [],
  };
  return record;
}

function noop(): void {
  void 0;
}
