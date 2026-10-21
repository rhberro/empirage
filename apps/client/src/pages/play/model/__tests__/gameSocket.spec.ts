import { expect, test } from 'bun:test';

import { PROTOCOL_VERSION } from '@creatures/contracts/game';

import { connectGameSocket } from '~/pages/play/model/gameSocket';
import type { GameSocketHandlers } from '~/pages/play/model/gameSocket';

const BASE_URL = 'https://api.example.com';
const TICKET = 'ticket-123';
const WAIT_MS = 30;

type Listener = (event: unknown) => void;

type FakeSocket = {
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

function installFakeSocket(): { sockets: FakeSocket[]; restore: () => void } {
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

function waitFor(milliseconds: number): Promise<void> {
  return new Promise(function resolveLater(resolve: () => void): void {
    setTimeout(resolve, milliseconds);
  });
}

type Handlers = {
  closed: number[];
  errors: string[];
  handlers: GameSocketHandlers;
};

function buildHandlers(): Handlers {
  const record: Handlers = {
    closed: [],
    errors: [],
    handlers: {
      onClose: function onClose(code: number): void {
        record.closed.push(code);
      },
      onCommandResult: noop,
      onError: function onError(message: string): void {
        record.errors.push(message);
      },
      onState: noop,
      onStatus: noop,
    },
  };
  return record;
}

function noop(): void {
  void 0;
}

/**
 * The ticket opens the channel, and the token of the account does not travel
 * in the address.
 */
test('the ticket opens the channel', function buildsUrl(): void {
  const fake = installFakeSocket();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: buildHandlers().handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  expect(fake.sockets[0].url).toBe(`wss://api.example.com/ws?ticket=${TICKET}`);
  fake.restore();
});

/**
 * The client tells the server which trainer it is, and the answer is
 * matched by the request that it carries.
 */
test('the client selects the trainer with a request id', function selectsTrainer(): void {
  const fake = installFakeSocket();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: buildHandlers().handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  const sent = fake.sockets[0].sent;
  expect(sent.length).toBe(1);
  const message = JSON.parse(sent[0]);
  expect(message.type).toBe('select_trainer');
  expect(message.trainerId).toBe('trainer-1');
  expect(message.v).toBe(PROTOCOL_VERSION);
  expect(typeof message.reqId).toBe('string');
  fake.restore();
});

/**
 * A message of another version is refused with clarity, and the connection
 * stays open: one broken message does not kill the channel.
 */
test('a message of another version does not kill the channel', function refusesVersion(): void {
  const fake = installFakeSocket();
  const record = buildHandlers();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('message', {
    data: JSON.stringify({ sentAt: 1, type: 'pong', v: PROTOCOL_VERSION + 1 }),
  });
  expect(record.errors.length).toBe(1);
  expect(record.closed.length).toBe(0);
  fake.restore();
});

/**
 * A connection that the server stops answering is a dead connection: the
 * client closes it and says that the server went quiet.
 */
test('the silence of the server kills the connection', function killsConnection(): Promise<void> {
  const fake = installFakeSocket();
  const record = buildHandlers();
  connectGameSocket({
    baseUrl: BASE_URL,
    handlers: record.handlers,
    livenessTimeoutMs: 10,
    ticket: TICKET,
    trainerId: 'trainer-1',
  });
  fake.sockets[0].emit('open');
  return waitFor(WAIT_MS).then(function assertSilence(): void {
    expect(record.errors.length).toBe(1);
    expect(record.closed.length).toBe(1);
    fake.restore();
  });
});
