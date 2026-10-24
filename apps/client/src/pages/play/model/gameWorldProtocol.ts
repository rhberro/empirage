import type { GameErrorCode } from '@creatures/contracts/game';
import type { ActorMedia, Direction, PathSegment, Tile } from '@creatures/contracts/world';

const DIRECTIONS: ReadonlySet<string> = new Set<Direction>([
  'up',
  'upRight',
  'right',
  'downRight',
  'down',
  'downLeft',
  'left',
  'upLeft',
]);

/**
 * The actors that left the city, as the server tells it.
 */
export type ActorLeaveMessage = {
  actorId: string;
  worldRev: number;
};

/**
 * The actor that entered the city or started a step.
 */
export type ActorUpdateMessage = {
  actor: ActorMedia;
  worldRev: number;
};

/**
 * The answer of the server to a move.
 *
 * The path is the whole walk, and its first segment starts on the confirmed
 * tile: the client replaces the step it had with the walk the server planned.
 */
export type MoveResult = {
  /** The rule that refused the move, when it was refused. */
  code: GameErrorCode | null;
  ok: boolean;
  path: PathSegment[];
  /** The request the answer belongs to. */
  reqId: string;
  worldRev: number;
};

/**
 * The dynamic part of the world around the observer.
 */
export type WorldStateMessage = {
  actors: ActorMedia[];
  worldRev: number;
  you: ActorMedia;
};

/**
 * The messages that carry the world.
 *
 * The world has its own branch of the protocol: it is light, it has its own
 * revision and it is read by the same rules as the rest of the channel.
 */
export type WorldPayload =
  | { kind: 'actor_leave'; leave: ActorLeaveMessage }
  | { kind: 'actor_update'; update: ActorUpdateMessage }
  | { kind: 'move_result'; result: MoveResult }
  | { kind: 'world_state'; world: WorldStateMessage };

export function readGameErrorCode(value: unknown): GameErrorCode | null {
  return typeof value === 'string' ? (value as GameErrorCode) : null;
}

/**
 * The world message of the type given, or null when the message does not make
 * sense. A type that is not of the world is not an error of this reader: the
 * caller keeps looking.
 */
export function readWorldPayload(type: unknown, value: object): WorldPayload | null {
  if (type === 'world_state') {
    return readWorldState(value);
  }
  if (type === 'move_result') {
    return readMoveResult(value);
  }
  if (type === 'actor_update') {
    return readActorUpdate(value);
  }
  if (type === 'actor_leave') {
    return readActorLeave(value);
  }
  return null;
}

/**
 * The world around the observer.
 *
 * A world message carries the actor of the connection and the actors the
 * observer sees; the actor inside the list is validated by the same rule as
 * the one of the connection, so a broken actor refuses the whole message.
 */
function readWorldState(value: object): WorldPayload | null {
  const message = value as { actors?: unknown; worldRev?: unknown; you?: unknown };
  if (!isWorldRev(message.worldRev) || !Array.isArray(message.actors)) {
    return null;
  }
  if (!isActorMedia(message.you)) {
    return null;
  }
  const actors: ActorMedia[] = [];
  for (const actor of message.actors) {
    if (!isActorMedia(actor)) {
      return null;
    }
    actors.push(actor);
  }
  return {
    kind: 'world_state',
    world: { actors, worldRev: message.worldRev, you: message.you },
  };
}

function readMoveResult(value: object): WorldPayload | null {
  const message = value as {
    code?: unknown;
    ok?: unknown;
    path?: unknown;
    reqId?: unknown;
    worldRev?: unknown;
  };
  if (typeof message.ok !== 'boolean' || typeof message.reqId !== 'string') {
    return null;
  }
  if (!isWorldRev(message.worldRev) || !Array.isArray(message.path)) {
    return null;
  }
  const path: PathSegment[] = [];
  for (const segment of message.path) {
    if (!isPathSegment(segment)) {
      return null;
    }
    path.push(segment);
  }
  return {
    kind: 'move_result',
    result: {
      code: readGameErrorCode(message.code),
      ok: message.ok,
      path,
      reqId: message.reqId,
      worldRev: message.worldRev,
    },
  };
}

function readActorUpdate(value: object): WorldPayload | null {
  const message = value as { actor?: unknown; worldRev?: unknown };
  if (!isWorldRev(message.worldRev) || !isActorMedia(message.actor)) {
    return null;
  }
  return { kind: 'actor_update', update: { actor: message.actor, worldRev: message.worldRev } };
}

function readActorLeave(value: object): WorldPayload | null {
  const message = value as { actorId?: unknown; worldRev?: unknown };
  if (!isWorldRev(message.worldRev) || typeof message.actorId !== 'string') {
    return null;
  }
  return { kind: 'actor_leave', leave: { actorId: message.actorId, worldRev: message.worldRev } };
}

function isWorldRev(value: unknown): value is number {
  return typeof value === 'number';
}

function isActorMedia(value: unknown): value is ActorMedia {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const actor = value as Partial<ActorMedia>;
  if (
    typeof actor.actorId !== 'string' ||
    typeof actor.name !== 'string' ||
    (actor.gender !== 'male' && actor.gender !== 'female') ||
    !isDirection(actor.dir) ||
    !isTile(actor.position)
  ) {
    return false;
  }
  return actor.segment === undefined || isPathSegment(actor.segment);
}

function isPathSegment(value: unknown): value is PathSegment {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const segment = value as Partial<PathSegment>;
  return (
    isTile(segment.from) &&
    isTile(segment.to) &&
    isDirection(segment.dir) &&
    typeof segment.startsAt === 'number' &&
    typeof segment.endsAt === 'number'
  );
}

function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && DIRECTIONS.has(value);
}

function isTile(value: unknown): value is Tile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const tile = value as Partial<Tile>;
  return typeof tile.x === 'number' && typeof tile.y === 'number';
}
