import { expect, test } from 'bun:test';

import type { ServerMessage } from '@creatures/contracts/game';
import type { ServerWebSocket } from 'bun';

import type { TrainerPositionRow } from '~/__tests__/fakeAdmin';
import { buildFakeAdmin } from '~/__tests__/fakeAdmin';
import { createWorldChannel } from '~/world/channel';
import type { WorldChannel } from '~/world/channel';
import { CITY_MAP } from '~/world/map';
import { createConnectionRegistry } from '~/ws/connections';
import type { SocketData } from '~/ws/connections';

const TRAINER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const USER_ID = 'user-1';

const PROFILE = { gender: 'male' as const, name: 'Beto', trainerId: TRAINER_ID };

function closeSocket(): void {
  // the channel removes the socket from the registry
}

type Harness = {
  channel: WorldChannel;
  saves: TrainerPositionRow[];
  sent: ServerMessage[];
  ws: ServerWebSocket<SocketData>;
};

function buildHarness(positions?: TrainerPositionRow[], saves: TrainerPositionRow[] = []): Harness {
  const connections = createConnectionRegistry();
  const channel = createWorldChannel({
    admin: buildFakeAdmin(undefined, { positions, saves }),
    connections,
  });
  const sent: ServerMessage[] = [];
  const ws = {
    close: closeSocket,
    data: { userId: USER_ID },
    send: function send(payload: string): void {
      sent.push(JSON.parse(payload) as ServerMessage);
    },
  } as unknown as ServerWebSocket<SocketData>;
  connections.open(ws);
  return { channel, saves, sent, ws };
}

function lastMessageOfType<T extends ServerMessage['type']>(
  sent: ServerMessage[],
  type: T,
): Extract<ServerMessage, { type: T }> | undefined {
  for (let index = sent.length - 1; index >= 0; index -= 1) {
    const message = sent[index];
    if (message.type === type) {
      return message as Extract<ServerMessage, { type: T }>;
    }
  }
  return undefined;
}

/**
 * The durable row is the start of the reconnect: the trainer appears where
 * the last process left it, not on the spawn.
 */
test('join uses the persisted position', function usesPersisted(): Promise<void> {
  const saved: TrainerPositionRow = {
    facing: 'left',
    trainer_id: TRAINER_ID,
    x: CITY_MAP.spawn.x,
    y: CITY_MAP.spawn.y + 1,
  };
  const harness = buildHarness([saved]);
  return harness.channel.enter(harness.ws, PROFILE).then(function assert(): void {
    const world = lastMessageOfType(harness.sent, 'world_state');
    expect(world?.you.position).toEqual({ x: saved.x, y: saved.y });
    expect(world?.you.dir).toBe('left');
  });
});

/**
 * A row written against another map, or a square that became solid, falls
 * back to the spawn instead of putting the trainer inside a wall.
 */
test('join falls back to the spawn on a solid row', function fallsBack(): Promise<void> {
  const solid: TrainerPositionRow = {
    facing: 'down',
    trainer_id: TRAINER_ID,
    x: 52,
    y: 29,
  };
  const harness = buildHarness([solid]);
  return harness.channel.enter(harness.ws, PROFILE).then(function assert(): void {
    const world = lastMessageOfType(harness.sent, 'world_state');
    expect(world?.you.position).toEqual(CITY_MAP.spawn);
    expect(world?.you.dir).toBe('down');
  });
});

/** Without a durable row the spawn is the only start. */
test('join falls back to the spawn without a row', function spawns(): Promise<void> {
  const harness = buildHarness();
  return harness.channel.enter(harness.ws, PROFILE).then(function assert(): void {
    const world = lastMessageOfType(harness.sent, 'world_state');
    expect(world?.you.position).toEqual(CITY_MAP.spawn);
  });
});

/**
 * A disconnect in the middle of a step persists the square the trainer was
 * entering, not the one it left.
 */
test('close writes the tile of the step in course', function writesOnClose(): Promise<void> {
  const harness = buildHarness();
  return harness.channel
    .enter(harness.ws, PROFILE)
    .then(function walk(): Promise<void> {
      harness.channel.move(harness.ws, 'move-close', {
        x: CITY_MAP.spawn.x,
        y: CITY_MAP.spawn.y + 1,
      });
      return harness.channel.close(harness.ws);
    })
    .then(function assertSave(): void {
      expect(harness.saves.at(-1)).toMatchObject({
        facing: 'down',
        trainer_id: TRAINER_ID,
        x: CITY_MAP.spawn.x,
        y: CITY_MAP.spawn.y + 1,
      });
    });
});
