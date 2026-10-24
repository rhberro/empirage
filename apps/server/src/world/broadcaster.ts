import { PROTOCOL_VERSION } from '@creatures/contracts/game';
import type { ActorMedia } from '@creatures/contracts/world';
import type { ServerWebSocket } from 'bun';

import type { WorldRegistry } from '~/world/registry';
import type { ConnectionRegistry, SocketData } from '~/ws/connections';
import { sendMessage } from '~/ws/protocol';

export type WorldBroadcaster = {
  /**
   * Tells the other actors that this one started a walk.
   *
   * The first step goes out now and each following step goes out when it
   * starts, so an actor is seen walking its whole path one segment at a time.
   */
  announce(userId: string): void;
  /** Tells the other actors that this one is in the world. */
  broadcastActor(userId: string): void;
  /** Tells the other actors that this one left. */
  broadcastLeave(userId: string): void;
  /** Sends the dynamic part of the world to one connection. */
  sendWorldState(ws: ServerWebSocket<SocketData>, userId: string): void;
};

type WorldChannelState = {
  connections: ConnectionRegistry;
  registry: WorldRegistry;
  timers: Map<string, ReturnType<typeof setTimeout>>;
};

/**
 * The channel of the world, lighter than the state broadcaster.
 *
 * It never reads the database and never rebuilds the player state: it only
 * forwards what changed in the world. The revision is taken per observer at
 * the moment the message is sent, so each connection sees its own monotonic
 * sequence.
 */
export function createWorldBroadcaster(
  registry: WorldRegistry,
  connections: ConnectionRegistry,
): WorldBroadcaster {
  const state: WorldChannelState = {
    connections,
    registry,
    timers: new Map<string, ReturnType<typeof setTimeout>>(),
  };

  function announce(userId: string): void {
    announceActor(state, userId);
    scheduleNextStep(state, userId);
  }

  function broadcastActor(userId: string): void {
    announceActor(state, userId);
  }

  function broadcastLeave(userId: string): void {
    announceLeave(state, userId);
  }

  function sendWorldState(ws: ServerWebSocket<SocketData>, userId: string): void {
    sendState(ws, state, userId);
  }

  return { announce, broadcastActor, broadcastLeave, sendWorldState };
}

function sendUpdate(state: WorldChannelState, observerId: string, actor: ActorMedia): void {
  const ws = state.connections.get(observerId);
  if (ws === undefined) {
    return;
  }
  sendMessage(ws, {
    actor,
    type: 'actor_update',
    v: PROTOCOL_VERSION,
    worldRev: state.registry.nextWorldRev(observerId),
  });
}

function announceActor(state: WorldChannelState, userId: string): void {
  const at = state.registry.now();
  const actor = state.registry.actor(userId, at);
  if (actor === undefined) {
    return;
  }
  for (const observerId of state.registry.presentIds()) {
    if (observerId === userId) {
      continue;
    }
    sendUpdate(state, observerId, actor);
  }
}

/**
 * Wakes up when the current step ends, to announce the next one.
 *
 * There is no tick of the world: the timer exists only because the client
 * receives one segment at a time and needs the next one when it begins. The
 * last step has no next, so the client settles on the `to` it already has.
 */
function scheduleNextStep(state: WorldChannelState, userId: string): void {
  clearTimer(state, userId);
  const at = state.registry.now();
  const actor = state.registry.actor(userId, at);
  const segment = actor?.segment;
  if (segment === undefined) {
    return;
  }
  const delay = Math.max(0, segment.endsAt - at);
  const timer = setTimeout(function onStepEnd(): void {
    state.timers.delete(userId);
    step(state, userId);
  }, delay);
  state.timers.set(userId, timer);
}

function step(state: WorldChannelState, userId: string): void {
  const at = state.registry.now();
  const actor = state.registry.actor(userId, at);
  if (actor?.segment === undefined) {
    return;
  }
  announceActor(state, userId);
  scheduleNextStep(state, userId);
}

function clearTimer(state: WorldChannelState, userId: string): void {
  const timer = state.timers.get(userId);
  if (timer === undefined) {
    return;
  }
  clearTimeout(timer);
  state.timers.delete(userId);
}

function announceLeave(state: WorldChannelState, userId: string): void {
  clearTimer(state, userId);
  for (const observerId of state.registry.presentIds()) {
    if (observerId === userId) {
      continue;
    }
    const ws = state.connections.get(observerId);
    if (ws === undefined) {
      continue;
    }
    sendMessage(ws, {
      actorId: userId,
      type: 'actor_leave',
      v: PROTOCOL_VERSION,
      worldRev: state.registry.nextWorldRev(observerId),
    });
  }
}

function sendState(
  ws: ServerWebSocket<SocketData>,
  state: WorldChannelState,
  userId: string,
): void {
  const at = state.registry.now();
  const you = state.registry.actor(userId, at);
  if (you === undefined) {
    return;
  }
  sendMessage(ws, {
    actors: state.registry.actors(at, userId),
    type: 'world_state',
    v: PROTOCOL_VERSION,
    worldRev: state.registry.nextWorldRev(userId),
    you,
  });
}
