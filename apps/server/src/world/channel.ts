import type { Direction, Tile } from '@creatures/contracts/world';
import { isWalkableTile } from '@creatures/contracts/world';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerWebSocket } from 'bun';
import type { Logger } from 'pino';

import { readTrainerPosition } from '~/db/positionRepository';
import type { TrainerPosition } from '~/db/positionRepository';
import { createWorldBroadcaster } from '~/world/broadcaster';
import type { WorldBroadcaster } from '~/world/broadcaster';
import { CITY_MAP } from '~/world/map';
import { createPositionWriter } from '~/world/positionWriter';
import type { PositionWriter } from '~/world/positionWriter';
import { createWorldRegistry } from '~/world/registry';
import type { ActorProfile, ActorStart, WorldRegistry } from '~/world/registry';
import { createWorldRuler } from '~/world/ruler';
import type { WorldRuler } from '~/world/ruler';
import type { ConnectionRegistry, SocketData } from '~/ws/connections';
import { sendMessage } from '~/ws/protocol';

const DEFAULT_FACING: Direction = 'down';

export type WorldChannel = {
  /** Completes the step in course, writes it and only then announces the leave. */
  close(ws: ServerWebSocket<SocketData>): Promise<void>;
  /** Puts the trainer in the world and sends the dynamic state to it. */
  enter(ws: ServerWebSocket<SocketData>, profile: ActorProfile): Promise<void>;
  /** Applies a walk command and answers on the connection that asked. */
  move(ws: ServerWebSocket<SocketData>, reqId: string, target: Tile): void;
};

export type WorldChannelDependencies = {
  admin: SupabaseClient;
  connections: ConnectionRegistry;
  logger?: Logger;
  /** Shortened by the tests; the process uses the one-second default. */
  positionFlushDelayMs?: number;
};

type ChannelState = {
  broadcaster: WorldBroadcaster;
  connections: ConnectionRegistry;
  positions: PositionWriter;
  registry: WorldRegistry;
  ruler: WorldRuler;
};

/**
 * The world as the WebSocket lane sees it.
 *
 * The lane owns the protocol and the world keeps the state: this channel is
 * the seam between them. The durable position is a write-behind here, fed by
 * the confirmed steps of the registry.
 */
export function createWorldChannel(deps: WorldChannelDependencies): WorldChannel {
  const positions = createPositionWriter({
    admin: deps.admin,
    delayMs: deps.positionFlushDelayMs,
    logger: deps.logger,
  });
  const registry = createWorldRegistry(CITY_MAP, {
    onStepConfirmed: function onStepConfirmed(confirmation): void {
      positions.mark(confirmation.trainerId, {
        facing: confirmation.dir,
        x: confirmation.position.x,
        y: confirmation.position.y,
      });
    },
  });
  const state: ChannelState = {
    broadcaster: createWorldBroadcaster(registry, deps.connections),
    connections: deps.connections,
    positions,
    registry,
    ruler: createWorldRuler(registry, CITY_MAP),
  };
  return {
    close(ws: ServerWebSocket<SocketData>): Promise<void> {
      return closeWorld(state, deps, ws);
    },
    enter(ws: ServerWebSocket<SocketData>, profile: ActorProfile): Promise<void> {
      return enterWorld(state, deps, ws, profile);
    },
    move(ws: ServerWebSocket<SocketData>, reqId: string, target: Tile): void {
      moveWorld(state, ws, reqId, target);
    },
  };
}

function closeWorld(
  state: ChannelState,
  deps: WorldChannelDependencies,
  ws: ServerWebSocket<SocketData>,
): Promise<void> {
  const userId = ws.data.userId;
  const current = state.connections.get(userId);
  const replaced = current !== undefined && current !== ws;
  state.connections.close(ws);
  if (replaced) {
    return Promise.resolve();
  }
  const trainerId = state.registry.trainerId(userId);
  const completed = state.registry.completeStep(userId, state.registry.now());
  const flush =
    trainerId === undefined ? Promise.resolve() : flushCompleted(state, trainerId, completed);
  // The durable tile lands before the others are told the actor is gone: a
  // reconnect from another process already sees the right one.
  return flush.then(finishClose(state, userId, ws), finishClose(state, userId, ws));
}

function finishClose(
  state: ChannelState,
  userId: string,
  ws: ServerWebSocket<SocketData>,
): () => void {
  return function finish(): void {
    // A newer connection may have opened while the position was being
    // written; it owns the actor now, and the old close must not take it out.
    const current = state.connections.get(userId);
    if (current !== undefined && current !== ws) {
      return;
    }
    const wasPresent = state.registry.leave(userId, state.registry.now());
    if (wasPresent) {
      state.broadcaster.broadcastLeave(userId);
    }
  };
}

function flushCompleted(
  state: ChannelState,
  trainerId: string,
  completed: { dir: Direction; position: Tile } | undefined,
): Promise<void> {
  if (completed !== undefined) {
    state.positions.mark(trainerId, {
      facing: completed.dir,
      x: completed.position.x,
      y: completed.position.y,
    });
  }
  return state.positions.flush(trainerId);
}

function enterWorld(
  state: ChannelState,
  deps: WorldChannelDependencies,
  ws: ServerWebSocket<SocketData>,
  profile: ActorProfile,
): Promise<void> {
  const userId = ws.data.userId;
  // The trainer may have been loaded for a connection that was replaced or
  // closed in the meantime; only the current one puts the actor in the world.
  if (state.connections.get(userId) !== ws) {
    return Promise.resolve();
  }
  return readPosition(deps, profile.trainerId).then(function join(saved): void {
    if (state.connections.get(userId) !== ws) {
      return;
    }
    const start = readStart(saved);
    const actor = state.registry.join(userId, { ...profile, start }, state.registry.now());
    state.positions.mark(profile.trainerId, {
      facing: actor.dir,
      x: actor.position.x,
      y: actor.position.y,
    });
    state.broadcaster.sendWorldState(ws, userId);
    state.broadcaster.broadcastActor(userId);
  });
}

function moveWorld(
  state: ChannelState,
  ws: ServerWebSocket<SocketData>,
  reqId: string,
  target: Tile,
): void {
  const userId = ws.data.userId;
  const answer = state.ruler.move(userId, reqId, target);
  sendMessage(ws, answer);
  if (answer.ok) {
    state.broadcaster.announce(userId);
  }
}

/**
 * The durable square is only a suggestion: a row written against another map,
 * or a tile that became solid, falls back to the spawn.
 */
function readStart(saved: TrainerPosition | null): ActorStart {
  if (saved !== null && isWalkableTile(CITY_MAP, saved)) {
    return { facing: saved.facing, x: saved.x, y: saved.y };
  }
  return { facing: DEFAULT_FACING, x: CITY_MAP.spawn.x, y: CITY_MAP.spawn.y };
}

function readPosition(
  deps: WorldChannelDependencies,
  trainerId: string,
): Promise<TrainerPosition | null> {
  return Promise.resolve()
    .then(function lookup(): Promise<TrainerPosition | null> {
      return readTrainerPosition(deps.admin, trainerId);
    })
    .catch(function fallback(error): null {
      // A database hiccup on entry must not keep the player out of the city:
      // the spawn is a safe tile and the position is rewritten from there.
      deps.logger?.warn({ err: error, trainerId }, 'trainer position read failed');
      return null;
    });
}
