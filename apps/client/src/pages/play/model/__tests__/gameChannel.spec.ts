import { expect, test } from 'bun:test';

import type { GameCommand } from '@creatures/contracts/game';
import type { Tile } from '@creatures/contracts/world';

import { openGameChannel } from '~/pages/play/model/gameChannel';
import type { GameChannelDeps } from '~/pages/play/model/gameChannel';
import type { MoveResult } from '~/pages/play/model/gameProtocol';
import type {
  GameSocket,
  GameSocketHandlers,
  GameSocketOptions,
} from '~/pages/play/model/gameSocket';

import { buildFakeGameSocket } from './gameChannelFixture';

const TRAINER_ID = 'trainer-1';
const WAIT_MS = 20;
const LOOP_WAIT_MS = 150;
const STABILITY_MS = 20;

/**
 * How many times the client opens the channel again before it gives up.
 */
const MAX_RETRIES = 6;

type ChannelFixture = {
  backoffs: number[];
  commands: { command: GameCommand; reqId: string | undefined }[];
  controller: ReturnType<typeof openGameChannel>;
  lost: number;
  moves: { reqId: string | undefined; target: Tile }[];
  sockets: GameSocketOptions[];
  ticketCalls: number;
};

type FixtureOptions = {
  /** What the server does with the channel that it opens. */
  onOpen?: (handlers: GameSocketHandlers) => void;
  stabilityMs?: number;
};

function noop(): void {
  void 0;
}

/**
 * The wait of the test is short: the backoff of the channel is the one of the
 * test.
 */
function waitFor(milliseconds: number): Promise<void> {
  return new Promise(function resolveLater(resolve: () => void): void {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * The wait of the backoff, in the test.
 */
function fastBackoff(): number {
  return 1;
}

/**
 * The channel of the test: the ticket and the socket are the ones of the
 * test.
 */
function openFixture(settings: FixtureOptions = {}): ChannelFixture {
  const fixture: ChannelFixture = {
    backoffs: [],
    commands: [],
    controller: null as unknown as ReturnType<typeof openGameChannel>,
    lost: 0,
    moves: [],
    sockets: [],
    ticketCalls: 0,
  };
  const deps: GameChannelDeps = {
    applySnapshot: noop,
    backoffDelay: function backoffDelay(attempt: number): number {
      fixture.backoffs.push(attempt);
      return fastBackoff();
    },
    connect: function connect(socketOptions: GameSocketOptions): GameSocket {
      fixture.sockets.push(socketOptions);
      if (settings.onOpen !== undefined) {
        settings.onOpen(socketOptions.handlers);
      }
      return buildFakeGameSocket(fixture);
    },
    onLost: function onLost(): void {
      fixture.lost += 1;
    },
    onOpen: noop,
    onWarning: noop,
    requestTicket: function requestTicket(): Promise<string> {
      fixture.ticketCalls += 1;
      return Promise.resolve(`ticket-${fixture.ticketCalls}`);
    },
    stabilityMs: settings.stabilityMs ?? STABILITY_MS,
    trainerId: TRAINER_ID,
  };
  fixture.controller = openGameChannel(deps);
  return fixture;
}

/**
 * The server that accepts the connection and closes it right away.
 */
function acceptAndClose(handlers: GameSocketHandlers): void {
  handlers.onStatus('open');
  handlers.onClose(1006);
}

/**
 * The server that accepts the connection and keeps it.
 */
function acceptAndKeep(handlers: GameSocketHandlers): void {
  handlers.onStatus('open');
}

/**
 * The connection that another connection of the same account took the place of
 * is not opened again: reconnecting would throw that one down, and the two
 * would take turns throwing each other down.
 */
test('the connection that was replaced is not opened again', function doesNotReopen(): Promise<void> {
  const fixture = openFixture();
  return waitFor(5)
    .then(function closeTheChannel(): Promise<void> {
      expect(fixture.sockets.length).toBe(1);
      fixture.sockets[0].handlers.onClose(4001);
      return waitFor(WAIT_MS);
    })
    .then(function assertNoReopen(): void {
      expect(fixture.lost).toBe(1);
      expect(fixture.ticketCalls).toBe(1);
      expect(fixture.sockets.length).toBe(1);
    });
});

/**
 * A channel that falls is opened again, with a ticket that is new: the ticket
 * is of one use, and the one that failed is not tried again.
 */
test('the channel that falls is opened again with a new ticket', function reopens(): Promise<void> {
  const fixture = openFixture();
  return waitFor(5)
    .then(function closeTheChannel(): Promise<void> {
      expect(fixture.sockets.length).toBe(1);
      fixture.sockets[0].handlers.onClose(1006);
      return waitFor(WAIT_MS);
    })
    .then(function assertReopen(): void {
      expect(fixture.ticketCalls).toBe(2);
      expect(fixture.sockets.length).toBe(2);
      expect(fixture.sockets[1].ticket).toBe('ticket-2');
    });
});

/**
 * The close that follows the switch of the treinador is the consequence of a
 * command of the player: it is not a lost connection, and the channel is not
 * opened again.
 */
test('the expected close does not open the channel again', function closes(): Promise<void> {
  const fixture = openFixture();
  return waitFor(5)
    .then(function closeTheChannel(): Promise<void> {
      fixture.controller.expectServerClose();
      fixture.sockets[0].handlers.onClose(1000);
      return waitFor(WAIT_MS);
    })
    .then(function assertNoReopen(): void {
      expect(fixture.lost).toBe(0);
      expect(fixture.ticketCalls).toBe(1);
    });
});

/**
 * The button of the screen opens the channel right away, without waiting for
 * the backoff.
 */
test('the button of the screen opens the channel right away', function reopensNow(): Promise<void> {
  const fixture = openFixture();
  return waitFor(5)
    .then(function pressTheButton(): Promise<void> {
      fixture.controller.reconnectNow();
      return waitFor(5);
    })
    .then(function assertReopen(): void {
      expect(fixture.ticketCalls).toBe(2);
      expect(fixture.sockets.length).toBe(2);
    });
});

/**
 * A server that accepts the connection and closes it right away does not
 * become one attempt per second, forever: the client counts the attempts and
 * gives up, showing the screen of the lost connection.
 */
test('the channel that opens and closes at once stops after the retries', function stopsTheLoop(): Promise<void> {
  const fixture = openFixture({ onOpen: acceptAndClose });
  return waitFor(LOOP_WAIT_MS).then(function assertStopped(): void {
    expect(fixture.lost).toBe(1);
    expect(fixture.sockets.length).toBe(MAX_RETRIES + 1);
    // The wait grows with the attempts: the client does not hammer the
    // server with one attempt per second.
    expect(fixture.backoffs).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

/**
 * A channel that holds is a channel that the server is up: the backoff
 * starts over, and the next wait is the base one.
 */
test('the channel that holds starts the backoff over', function startsOver(): Promise<void> {
  const fixture = openFixture({ onOpen: acceptAndKeep });
  return waitFor(5)
    .then(function firstFall(): Promise<void> {
      fixture.sockets[0].handlers.onClose(1006);
      return waitFor(5);
    })
    .then(function holdTheChannel(): Promise<void> {
      // The second channel holds for longer than the stability time.
      return waitFor(STABILITY_MS + 20);
    })
    .then(function secondFall(): Promise<void> {
      fixture.sockets[1].handlers.onClose(1006);
      return waitFor(WAIT_MS);
    })
    .then(function assertBaseDelay(): void {
      // The second wait is the base one: the channel held, the server is up.
      expect(fixture.backoffs).toEqual([0, 0]);
    });
});

/**
 * A channel that falls before it holds keeps the growth of the backoff.
 */
test('the channel that does not hold grows the backoff', function growsTheBackoff(): Promise<void> {
  const fixture = openFixture({ onOpen: acceptAndClose });
  return waitFor(LOOP_WAIT_MS).then(function assertGrowth(): void {
    expect(fixture.backoffs.slice(0, 2)).toEqual([0, 1]);
  });
});

/**
 * The move goes through the socket of the attempt that is open: the machine
 * does not keep a socket of its own.
 */
test('the move goes through the open socket', function sendsMove(): Promise<void> {
  const fixture = openFixture();
  return waitFor(5)
    .then(function move(): Promise<MoveResult> {
      return fixture.controller.requestMove({ x: 2, y: 3 });
    })
    .then(function assertMove(): void {
      expect(fixture.moves.length).toBe(1);
      expect(fixture.moves[0].target).toEqual({ x: 2, y: 3 });
    });
});

/**
 * A move asked after the channel fell is refused instead of waiting forever.
 */
test('the move without an open channel is refused', function refusesMove(): Promise<void> {
  const fixture = openFixture();
  fixture.controller.close();
  return fixture.controller.requestMove({ x: 1, y: 1 }).then(
    function noRefusal(): void {
      expect(false).toBe(true);
    },
    function onRefusal(caught: unknown): void {
      expect(caught instanceof Error).toBe(true);
    },
  );
});
