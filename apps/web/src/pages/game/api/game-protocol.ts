import { readHuntState } from './hunt-protocol';
/* eslint-disable max-lines */
import type { HuntStateEvent } from './hunt-protocol';

export const GAME_PROTOCOL_VERSION = 1;
export const GAME_TICKS_PER_SECOND = 30;

export type Tile = { x: number; y: number };
export type Direction = 'east' | 'north' | 'south' | 'west';
export type ProtocolDirection = 'down' | 'left' | 'right' | 'up';
export type ServerDirection =
  | ProtocolDirection
  | 'down-left'
  | 'down-right'
  | 'up-left'
  | 'up-right';
export type MovementMode = 'running' | 'walking';
export type Movement = {
  direction: ServerDirection;
  duration: number;
  from: Tile;
  id: string;
  mode: MovementMode;
  startedAt: number;
  to: Tile;
};
export type PlayerState = {
  characterId: string;
  movement: Movement | null;
  tick: number;
  tile: Tile;
};
type PlayerStates = Array<PlayerState>;
export type AuthenticationCommand = {
  characterId: string;
  token: string;
  type: 'authenticate';
  version: typeof GAME_PROTOCOL_VERSION;
};
export type InputState = Record<ProtocolDirection, boolean> & { running: boolean };
export type InputCommand = {
  input: InputState;
  priority: ProtocolDirection;
  sequence: number;
  type: 'input';
  version: typeof GAME_PROTOCOL_VERSION;
};
export type HuntClockCommand = {
  sentAt: number;
  type: 'hunt_clock';
  version: typeof GAME_PROTOCOL_VERSION;
};
export type HuntClockEvent = {
  receivedAt: number;
  sentAt: number;
  serverTime: number;
  type: 'hunt_clock';
};
export type AuthenticatedEvent = { characterId: string; position: Tile; type: 'authenticated' };
export type SnapshotEvent = { players: PlayerStates; tick: number; type: 'snapshot' };
export type MovementStartedEvent = {
  characterId: string;
  movement: Movement;
  tick: number;
  type: 'movement_started';
};
export type PlayerJoinedEvent = {
  characterId: string;
  direction: Direction;
  mode: MovementMode;
  position: Tile;
  tick: number;
  type: 'player_joined';
};
type PlayerIdleEventType = { type: 'player_idle' };
export type PlayerIdleEvent = Omit<PlayerJoinedEvent, 'type'> & PlayerIdleEventType;
export type PlayerLeftEvent = { characterId: string; tick: number; type: 'player_left' };
export type HeartbeatEvent = { type: 'heartbeat' };
export type ErrorEvent = { code: string; type: 'error' };
export type InputRejectedEvent = { code: string; reason: string; type: 'input_rejected' };
export type ConnectionStatusEvent = { message: string; type: 'connection_status' };
export type GameEvent =
  | AuthenticatedEvent
  | ConnectionStatusEvent
  | ErrorEvent
  | HeartbeatEvent
  | HuntClockEvent
  | HuntStateEvent
  | InputRejectedEvent
  | MovementStartedEvent
  | PlayerIdleEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | SnapshotEvent;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function readTile(value: unknown): Tile | null {
  if (
    !isRecord(value) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  ) {
    return null;
  }
  return { x: value.x, y: value.y };
}

function readMode(value: unknown): MovementMode | null {
  return value === 'running' || value === 'walking' ? value : null;
}

function readPresenceDirection(value: unknown): Direction | null {
  if (value === 'down' || value === 'down-left' || value === 'down-right') {
    return 'south';
  }
  if (value === 'left') {
    return 'west';
  }
  if (value === 'right') {
    return 'east';
  }
  if (value === 'up' || value === 'up-left' || value === 'up-right') {
    return 'north';
  }
  return null;
}

function isTick(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isDurationTicks(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function readServerDirection(value: unknown): ServerDirection | null {
  if (
    value === 'down' ||
    value === 'down-left' ||
    value === 'down-right' ||
    value === 'left' ||
    value === 'right' ||
    value === 'up' ||
    value === 'up-left' ||
    value === 'up-right'
  ) {
    return value;
  }
  return null;
}

function readMovement(value: unknown, currentTick: number): Movement | null {
  if (!isRecord(value)) {
    return null;
  }
  const from = readTile(value.from);
  const to = readTile(value.to);
  const mode = readMode(value.mode);
  const direction = readServerDirection(value.direction);
  if (
    !from ||
    !to ||
    !mode ||
    !direction ||
    typeof value.movementId !== 'string' ||
    value.movementId.length === 0 ||
    !isTick(value.startTick) ||
    !isDurationTicks(value.durationTicks)
  ) {
    return null;
  }
  const tickDuration = 1_000 / GAME_TICKS_PER_SECOND;
  return {
    direction,
    duration: value.durationTicks * tickDuration,
    from,
    id: value.movementId,
    mode,
    startedAt: Date.now() - Math.max(0, currentTick - value.startTick) * tickDuration,
    to,
  };
}

function readPlayer(value: unknown, tick: number): PlayerState | null {
  if (!isRecord(value) || typeof value.characterId !== 'string') {
    return null;
  }
  const tile = readTile(value);
  const movement = value.movement === undefined ? null : readMovement(value.movement, tick);
  if (!tile || (value.movement !== undefined && !movement)) {
    return null;
  }
  return { characterId: value.characterId, movement, tick, tile };
}

function readPresence(
  value: UnknownRecord,
  type: 'player_idle' | 'player_joined',
): GameEvent | null {
  const position = readTile(value.position);
  const direction = readPresenceDirection(value.direction);
  const mode = value.mode === 'idle' ? 'walking' : readMode(value.mode);
  if (
    !position ||
    !direction ||
    !mode ||
    typeof value.characterId !== 'string' ||
    !isTick(value.tick)
  ) {
    return null;
  }
  return { characterId: value.characterId, direction, mode, position, tick: value.tick, type };
}

function readAuthenticated(value: UnknownRecord): AuthenticatedEvent | null {
  const position = readTile(value.position);
  if (!position || typeof value.characterId !== 'string') {
    return null;
  }
  return { characterId: value.characterId, position, type: 'authenticated' };
}

function readSnapshot(value: UnknownRecord): SnapshotEvent | null {
  if (!isTick(value.tick) || !Array.isArray(value.players)) {
    return null;
  }
  const players: PlayerStates = [];
  for (const item of value.players) {
    const player = readPlayer(item, value.tick);
    if (!player) {
      return null;
    }
    players.push(player);
  }
  return { players, tick: value.tick, type: 'snapshot' };
}

function readMovementStarted(value: UnknownRecord): MovementStartedEvent | null {
  if (typeof value.characterId !== 'string' || !isTick(value.startTick)) {
    return null;
  }
  const movement = readMovement(value, value.startTick);
  return movement
    ? {
        characterId: value.characterId,
        movement,
        tick: value.startTick,
        type: 'movement_started',
      }
    : null;
}

function readPlayerLeft(value: UnknownRecord): PlayerLeftEvent | null {
  if (typeof value.characterId !== 'string' || !isTick(value.tick)) {
    return null;
  }
  return { characterId: value.characterId, tick: value.tick, type: 'player_left' };
}

function readHuntClock(value: UnknownRecord): HuntClockEvent | null {
  if (
    typeof value.sentAt !== 'number' ||
    !Number.isFinite(value.sentAt) ||
    typeof value.serverTime !== 'number' ||
    !Number.isFinite(value.serverTime)
  ) {
    return null;
  }
  return {
    receivedAt: Date.now(),
    sentAt: value.sentAt,
    serverTime: value.serverTime,
    type: 'hunt_clock',
  };
}

// Protocol dispatch necessarily branches over every supported envelope type.
// eslint-disable-next-line complexity
export function parseGameEvent(value: unknown): GameEvent | null {
  if (!isRecord(value) || value.version !== GAME_PROTOCOL_VERSION) {
    return null;
  }
  if (value.type === 'authenticated') {
    return readAuthenticated(value);
  }
  if (value.type === 'hunt_state') {
    return readHuntState(value.hunt, value.huntId);
  }
  if (value.type === 'hunt_clock') {
    return readHuntClock(value);
  }
  if (value.type === 'snapshot') {
    return readSnapshot(value);
  }
  if (value.type === 'movement_started') {
    return readMovementStarted(value);
  }
  if (value.type === 'player_joined' || value.type === 'player_idle') {
    return readPresence(value, value.type);
  }
  if (value.type === 'player_left') {
    return readPlayerLeft(value);
  }
  if (value.type === 'heartbeat') {
    return { type: 'heartbeat' };
  }
  if (value.type === 'error' && typeof value.code === 'string') {
    return { code: value.code, type: 'error' };
  }
  if (
    value.type === 'input_rejected' &&
    typeof value.code === 'string' &&
    typeof value.reason === 'string'
  ) {
    return { code: value.code, reason: value.reason, type: 'input_rejected' };
  }
  return null;
}
