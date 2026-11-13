import { randomUUID } from 'node:crypto';
/* eslint-disable max-lines */

import { config } from '../config.ts';
import { logger } from '../logger.ts';
import type {
  AuthenticatedState,
  CardinalDirection,
  CharacterRow,
  ClientMessage,
  Direction,
  InputState,
  Movement,
  MovementMode,
  Position,
  SocketData,
} from './game-types.ts';
import { isPositionWithin, positionAfterVector } from './grid-movement.ts';
import {
  configureHuntHealingItem,
  configureHuntAbility,
  findAccountHunt,
  findHunt,
  leaveHunt,
  setHuntNotifier,
  startHunt,
  type HuntState,
} from './hunting.ts';
import { createAuthenticatedClient, createServerClient, parseMessage } from './protocol.ts';

const PROTOCOL_VERSION = 1;
const TICKS_PER_SECOND = 30;
const TICK_INTERVAL_MS = 1_000 / TICKS_PER_SECOND;
const MAXIMUM_CATCH_UP_TICKS = 5;
const WALKING_CARDINAL_DURATION_TICKS = 12;
const RUNNING_CARDINAL_DURATION_TICKS = 8;
const WALKING_DIAGONAL_DURATION_TICKS = Math.round(WALKING_CARDINAL_DURATION_TICKS * Math.SQRT2);
const RUNNING_DIAGONAL_DURATION_TICKS = Math.round(RUNNING_CARDINAL_DURATION_TICKS * Math.SQRT2);
const SNAPSHOT_INTERVAL_TICKS = TICKS_PER_SECOND * 5;
const PERSISTENCE_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const INPUT_TIMEOUT_MS = 2_000;
const MAXIMUM_BUFFERED_BYTES = 64 * 1_024;
const MAP_MAXIMUM_TILE = 99;
const SERVER_EPOCH = randomUUID();
const characterPersistenceClient = createServerClient();
type AuthenticationMessage = ClientMessage & { characterId: string; token: string };
type PlayerSnapshot = { characterId: string; movement?: MovementSnapshot; x: number; y: number };
type MovementSnapshot = {
  direction: Direction;
  durationTicks: number;
  from: Position;
  movementId: string;
  mode: MovementMode;
  startTick: number;
  to: Position;
};
type Vector = { direction: Direction; x: number; y: number };
type CardinalDirections = Array<CardinalDirection>;
type GameSocket = Bun.ServerWebSocket<SocketData>;
type PlayerSnapshots = Array<PlayerSnapshot>;
type Persistences = Array<Promise<void>>;
const CARDINAL_DIRECTIONS: CardinalDirections = ['down', 'left', 'right', 'up'];
const connectionsByAccount = new Map<string, GameSocket>();
const authenticatedSockets = new Set<GameSocket>();
const connectionGenerationByCharacter = new Map<string, number>();
const persistenceByCharacter = new Map<string, Promise<void>>();
let nextConnectionGeneration = 1;
let tickNumber = 0;
let accumulatorMs = 0;
let previousLoopTime = globalThis.performance.now();
let isShuttingDown = false;

function emptyInput(): InputState {
  return { down: false, left: false, right: false, running: false, up: false };
}

function send(
  socket: Bun.ServerWebSocket<SocketData>,
  payload: object,
  replaceable = false,
): boolean {
  if (socket.getBufferedAmount() > MAXIMUM_BUFFERED_BYTES) {
    if (!replaceable) {
      socket.close(1013, 'backpressure');
    }
    return false;
  }
  const authenticated = socket.data.authenticated;
  const envelope = {
    ...payload,
    connectionGeneration: authenticated ? authenticated.connectionGeneration : undefined,
    serverEpoch: SERVER_EPOCH,
  };
  socket.send(JSON.stringify(envelope));
  return true;
}

function movementSnapshot(movement: Movement): MovementSnapshot {
  return {
    direction: movement.direction,
    durationTicks: movement.durationTicks,
    from: movement.fromTile,
    mode: movement.mode,
    movementId: movement.movementId,
    startTick: movement.startTick,
    to: movement.toTile,
  };
}

function createSnapshot(initialState?: AuthenticatedState): object {
  const players: PlayerSnapshots = [];
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (!state || state.hunting) {
      continue;
    }
    const player: PlayerSnapshot = {
      characterId: state.characterId,
      x: state.position.x,
      y: state.position.y,
    };
    if (state.movement) {
      player.movement = movementSnapshot(state.movement);
    }
    players.push(player);
  }
  if (initialState && !initialState.hunting) {
    const player: PlayerSnapshot = {
      characterId: initialState.characterId,
      x: initialState.position.x,
      y: initialState.position.y,
    };
    if (initialState.movement) {
      player.movement = movementSnapshot(initialState.movement);
    }
    players.push(player);
  }
  return { players, tick: tickNumber, type: 'snapshot', version: PROTOCOL_VERSION };
}

function closeWithError(
  socket: Bun.ServerWebSocket<SocketData>,
  code: number,
  reason: string,
): void {
  send(socket, { code: reason, type: 'error', version: PROTOCOL_VERSION });
  socket.close(code, reason);
}

function isAuthenticationMessage(
  clientMessage: ClientMessage,
): clientMessage is AuthenticationMessage {
  return (
    clientMessage.type === 'authenticate' &&
    clientMessage.version === PROTOCOL_VERSION &&
    typeof clientMessage.token === 'string' &&
    typeof clientMessage.characterId === 'string'
  );
}

function replacePreviousConnection(
  accountId: string,
  socket: Bun.ServerWebSocket<SocketData>,
): void {
  const previous = connectionsByAccount.get(accountId);
  if (previous && previous !== socket) {
    authenticatedSockets.delete(previous);
    closeWithError(previous, 4001, 'connection_replaced');
  }
}

function broadcastExcept(payload: object, excludedSocket: GameSocket): void {
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (socket !== excludedSocket && state && !state.hunting) {
      send(socket, payload);
    }
  }
}

// Authentication necessarily coordinates token, ownership, connection replacement, and initial state.
// eslint-disable-next-line max-lines-per-function
async function authenticate(
  socket: Bun.ServerWebSocket<SocketData>,
  clientMessage: ClientMessage,
): Promise<void> {
  if (!isAuthenticationMessage(clientMessage)) {
    closeWithError(socket, 1008, 'invalid_authentication_message');
    return;
  }
  const supabase = createAuthenticatedClient(clientMessage.token);
  const { data: userData, error: userError } = await supabase.auth.getUser(clientMessage.token);
  if (userError || !userData.user) {
    closeWithError(socket, 1008, 'invalid_access_token');
    return;
  }
  const previous = connectionsByAccount.get(userData.user.id);
  if (previous && previous !== socket) {
    await persist(previous);
  }
  const { data, error } = await supabase
    .from('characters')
    .select('id, user_id, position_x, position_y')
    .eq('id', clientMessage.characterId)
    .eq('user_id', userData.user.id)
    .maybeSingle<CharacterRow>();
  if (error || !data) {
    closeWithError(socket, 1008, 'character_not_found');
    return;
  }
  const position = {
    x: Math.min(MAP_MAXIMUM_TILE, Math.max(0, Math.trunc(data.position_x))),
    y: Math.min(MAP_MAXIMUM_TILE, Math.max(0, Math.trunc(data.position_y))),
  };
  const accountHunt = await findAccountHunt(userData.user.id);
  if (accountHunt && accountHunt.character_id !== data.id) {
    closeWithError(socket, 1008, 'another_character_is_hunting');
    return;
  }
  const hunt = await findHunt(data.id);
  replacePreviousConnection(userData.user.id, socket);
  globalThis.clearTimeout(socket.data.authenticationTimer);
  socket.data.authenticated = {
    accountId: userData.user.id,
    characterId: data.id,
    connectionGeneration: nextConnectionGeneration,
    dirty: false,
    dirtyVersion: 0,
    huntTransitioning: false,
    hunting: Boolean(hunt),
    input: emptyInput(),
    lastInputAt: Date.now(),
    lastInputRejectionAt: 0,
    lastSequence: -1,
    position,
    priority: 'down',
    requestedMode: 'walking',
    supabase,
  };
  nextConnectionGeneration += 1;
  const joined = {
    characterId: data.id,
    direction: 'down',
    mode: 'idle',
    position,
    tick: tickNumber,
    type: 'player_joined',
    version: PROTOCOL_VERSION,
  };
  const state = socket.data.authenticated;
  const snapshotSent = send(socket, createSnapshot(state));
  const authenticatedSent = send(socket, {
    characterId: data.id,
    position,
    type: 'authenticated',
    version: PROTOCOL_VERSION,
  });
  if (!snapshotSent || !authenticatedSent) {
    socket.close(1013, 'initial_state_unavailable');
    return;
  }
  connectionGenerationByCharacter.set(data.id, state.connectionGeneration);
  connectionsByAccount.set(userData.user.id, socket);
  authenticatedSockets.add(socket);
  if (!hunt) {
    broadcastExcept(joined, socket);
  }
  if (hunt) {
    sendHuntState(socket, hunt);
  }
}

function sendHuntState(
  socket: GameSocket,
  hunt: HuntState | undefined,
  endedHuntId?: string,
): void {
  const huntId = hunt ? hunt.huntId : endedHuntId;
  send(socket, { hunt: hunt ?? null, huntId, type: 'hunt_state', version: PROTOCOL_VERSION });
}

function handleHuntClock(socket: GameSocket, clientMessage: ClientMessage): boolean {
  if (
    clientMessage.type !== 'hunt_clock' ||
    clientMessage.version !== PROTOCOL_VERSION ||
    typeof clientMessage.sentAt !== 'number' ||
    !Number.isFinite(clientMessage.sentAt)
  ) {
    return false;
  }
  send(socket, {
    sentAt: clientMessage.sentAt,
    serverTime: Date.now(),
    type: 'hunt_clock',
    version: PROTOCOL_VERSION,
  });
  return true;
}

function cityPresence(state: AuthenticatedState, type: 'player_joined' | 'player_left'): object {
  return {
    characterId: state.characterId,
    direction: 'down',
    mode: 'idle',
    position: state.position,
    tick: tickNumber,
    type,
    version: PROTOCOL_VERSION,
  };
}

async function configureHealingItem(
  socket: GameSocket,
  state: AuthenticatedState,
  clientMessage: ClientMessage,
): Promise<void> {
  if (
    typeof clientMessage.healingItemId !== 'number' ||
    !Number.isSafeInteger(clientMessage.healingItemId) ||
    typeof clientMessage.healingThresholdPercentage !== 'number' ||
    !Number.isSafeInteger(clientMessage.healingThresholdPercentage)
  ) {
    throw new TypeError('invalid_healing_configuration');
  }
  const hunt = await configureHuntHealingItem(
    state.characterId,
    state.accountId,
    clientMessage.healingItemId,
    clientMessage.healingThresholdPercentage,
  );
  if (hunt) {
    sendHuntState(socket, hunt);
  }
}

async function configureAbility(
  socket: GameSocket,
  state: AuthenticatedState,
  clientMessage: ClientMessage,
): Promise<void> {
  if (
    typeof clientMessage.abilitySlot !== 'number' ||
    !Number.isSafeInteger(clientMessage.abilitySlot) ||
    (clientMessage.abilityId !== null &&
      (typeof clientMessage.abilityId !== 'number' ||
        !Number.isSafeInteger(clientMessage.abilityId)))
  ) {
    throw new TypeError('invalid_ability_configuration');
  }
  const hunt = await configureHuntAbility(
    state.characterId,
    state.accountId,
    clientMessage.abilitySlot,
    clientMessage.abilityId,
  );
  if (hunt) {
    sendHuntState(socket, hunt);
  }
}

async function handleStartHunt(socket: GameSocket, state: AuthenticatedState): Promise<void> {
  if (state.hunting) {
    sendHuntState(socket, await findHunt(state.characterId));
    return;
  }
  state.input = emptyInput();
  state.movement = undefined;
  await persist(socket);
  const hunt = await startHunt(state.characterId, state.accountId);
  state.hunting = true;
  broadcastExcept(cityPresence(state, 'player_left'), socket);
  sendHuntState(socket, hunt);
}

async function handleLeaveHunt(socket: GameSocket, state: AuthenticatedState): Promise<void> {
  if (!state.hunting) {
    return;
  }
  const hunt = await findHunt(state.characterId);
  const left = hunt ? await leaveHunt(hunt) : true;
  const current = left ? undefined : await findHunt(state.characterId);
  if (current) {
    sendHuntState(socket, current);
    return;
  }
  state.hunting = false;
  sendHuntState(socket, undefined, hunt ? hunt.huntId : undefined);
  broadcastExcept(cityPresence(state, 'player_joined'), socket);
  send(socket, createSnapshot());
}

async function handleHuntCommand(
  socket: GameSocket,
  clientMessage: ClientMessage,
): Promise<boolean> {
  const state = socket.data.authenticated;
  if (!state || state.huntTransitioning || clientMessage.version !== PROTOCOL_VERSION) {
    return false;
  }
  if (clientMessage.type === 'configure_healing_item') {
    await configureHealingItem(socket, state, clientMessage);
    return true;
  }
  if (clientMessage.type === 'configure_ability') {
    await configureAbility(socket, state, clientMessage);
    return true;
  }
  if (clientMessage.type !== 'start_hunt' && clientMessage.type !== 'leave_hunt') {
    return false;
  }
  state.huntTransitioning = true;
  try {
    if (clientMessage.type === 'start_hunt') {
      await handleStartHunt(socket, state);
    } else {
      await handleLeaveHunt(socket, state);
    }
  } finally {
    state.huntTransitioning = false;
  }
  return true;
}

function isInputState(value: unknown): value is InputState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const input = value as Partial<InputState>;
  function isBoolean(direction: CardinalDirection): boolean {
    return typeof input[direction] === 'boolean';
  }
  return (
    Object.keys(input).length === CARDINAL_DIRECTIONS.length + 1 &&
    CARDINAL_DIRECTIONS.every(isBoolean) &&
    typeof input.running === 'boolean'
  );
}

function isPriority(value: unknown): value is CardinalDirection {
  return typeof value === 'string' && CARDINAL_DIRECTIONS.includes(value as CardinalDirection);
}

function rejectInput(socket: GameSocket, reason: string): void {
  const state = socket.data.authenticated;
  if (!state) {
    return;
  }
  const now = Date.now();
  const repeatedRecently =
    state.lastInputRejectionReason === reason && now - state.lastInputRejectionAt < 5_000;
  if (repeatedRecently) {
    return;
  }
  state.lastInputRejectionAt = now;
  state.lastInputRejectionReason = reason;
  const details = { characterId: state.characterId, reason, sequence: state.lastSequence };
  logger.warn(details, 'player input rejected');
  send(socket, { code: reason, reason, type: 'input_rejected', version: PROTOCOL_VERSION });
}

function handleInput(socket: GameSocket, clientMessage: ClientMessage): void {
  const validSequence =
    typeof clientMessage.sequence === 'number' &&
    Number.isSafeInteger(clientMessage.sequence) &&
    clientMessage.sequence >= 0;
  if (
    clientMessage.version !== PROTOCOL_VERSION ||
    clientMessage.type !== 'input' ||
    !isInputState(clientMessage.input) ||
    !isPriority(clientMessage.priority) ||
    !validSequence
  ) {
    closeWithError(socket, 1008, 'invalid_message');
    return;
  }
  const state = socket.data.authenticated;
  if (!state) {
    return;
  }
  if (state.huntTransitioning) {
    rejectInput(socket, 'hunt_transitioning');
    return;
  }
  if (state.hunting) {
    rejectInput(socket, 'character_is_hunting');
    return;
  }
  if ((clientMessage.sequence as number) <= state.lastSequence) {
    rejectInput(socket, 'stale_sequence');
    return;
  }
  state.input = clientMessage.input;
  state.priority = clientMessage.priority;
  state.requestedMode = clientMessage.input.running ? 'running' : 'walking';
  state.lastSequence = clientMessage.sequence as number;
  state.lastInputAt = Date.now();
}

function exceedsRateLimit(data: SocketData): boolean {
  const now = Date.now();
  if (now - data.messageWindowStartedAt >= 1_000) {
    data.messageCount = 0;
    data.messageWindowStartedAt = now;
  }
  data.messageCount += 1;
  return data.messageCount > config.websocketMaximumMessagesPerSecond;
}

async function processMessage(
  socket: Bun.ServerWebSocket<SocketData>,
  rawMessage: string | Buffer,
): Promise<void> {
  if (rawMessage.length > config.websocketMaximumMessageBytes) {
    closeWithError(socket, 1009, 'message_too_large');
    return;
  }
  if (exceedsRateLimit(socket.data)) {
    closeWithError(socket, 1008, 'rate_limit_exceeded');
    return;
  }
  const parsed = parseMessage(rawMessage);
  if (!parsed) {
    closeWithError(socket, 1008, 'invalid_json');
    return;
  }
  if (socket.data.authenticated) {
    if (handleHuntClock(socket, parsed)) {
      return;
    }
    if (socket.data.authenticated.huntTransitioning) {
      if (parsed.type === 'input') {
        handleInput(socket, parsed);
      } else {
        send(socket, { code: 'hunt_transitioning', type: 'error', version: PROTOCOL_VERSION });
      }
      return;
    }
    try {
      if (await handleHuntCommand(socket, parsed)) {
        return;
      }
    } catch (error) {
      const details = { characterId: socket.data.authenticated.characterId, error };
      logger.error(details, 'hunt command failed');
      send(socket, { code: 'hunt_command_failed', type: 'error', version: PROTOCOL_VERSION });
      return;
    }
    handleInput(socket, parsed);
    return;
  }
  if (socket.data.authenticating) {
    closeWithError(socket, 1008, 'authentication_in_progress');
    return;
  }
  socket.data.authenticating = true;
  await authenticate(socket, parsed);
}

async function message(
  socket: Bun.ServerWebSocket<SocketData>,
  rawMessage: string | Buffer,
): Promise<void> {
  if (rejectMessageDuringShutdown(socket)) {
    return;
  }
  await processMessage(socket, rawMessage);
}

function rejectMessageDuringShutdown(socket: GameSocket): boolean {
  if (!isShuttingDown) {
    return false;
  }
  closeWithError(socket, 1012, 'server_shutting_down');
  return true;
}

function inputVector(state: AuthenticatedState): Vector | undefined {
  let x = Number(state.input.right) - Number(state.input.left);
  let y = Number(state.input.down) - Number(state.input.up);
  if (x === 0 && state.input.left && state.input.right) {
    x = state.priority === 'left' ? -1 : 1;
  }
  if (y === 0 && state.input.up && state.input.down) {
    y = state.priority === 'up' ? -1 : 1;
  }
  if (x === 0 && y === 0) {
    return undefined;
  }
  const vertical = y < 0 ? 'up' : 'down';
  const horizontal = x < 0 ? 'left' : 'right';
  const direction: Direction =
    x !== 0 && y !== 0 ? `${vertical}-${horizontal}` : x === 0 ? vertical : horizontal;
  return { direction, x, y };
}

function startMovement(state: AuthenticatedState): Movement | undefined {
  const vector = inputVector(state);
  if (!vector) {
    return undefined;
  }
  const toTile = positionAfterVector(state.position, vector);
  const mapSize = MAP_MAXIMUM_TILE + 1;
  if (!isPositionWithin(toTile, mapSize, mapSize)) {
    return undefined;
  }
  const diagonal = vector.x !== 0 && vector.y !== 0;
  const durationTicks =
    state.requestedMode === 'running'
      ? diagonal
        ? RUNNING_DIAGONAL_DURATION_TICKS
        : RUNNING_CARDINAL_DURATION_TICKS
      : diagonal
        ? WALKING_DIAGONAL_DURATION_TICKS
        : WALKING_CARDINAL_DURATION_TICKS;
  return {
    direction: vector.direction,
    durationTicks,
    fromTile: { ...state.position },
    mode: state.requestedMode,
    movementId: randomUUID(),
    startTick: tickNumber,
    startTime: Date.now(),
    toTile,
  };
}

function broadcast(payload: object, replaceable = false): void {
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (state && !state.hunting && !state.huntTransitioning) {
      send(socket, payload, replaceable);
    }
  }
}

function updatePlayer(state: AuthenticatedState): void {
  if (Date.now() - state.lastInputAt > INPUT_TIMEOUT_MS) {
    state.input = emptyInput();
    state.requestedMode = 'walking';
  }
  let completedMovement: Movement | undefined;
  if (state.movement && tickNumber - state.movement.startTick >= state.movement.durationTicks) {
    completedMovement = state.movement;
    state.position = completedMovement.toTile;
    state.movement = undefined;
    state.dirty = true;
    state.dirtyVersion += 1;
  }
  if (state.movement) {
    return;
  }
  const movement = startMovement(state);
  if (!movement) {
    if (completedMovement) {
      const idle = {
        characterId: state.characterId,
        direction: completedMovement.direction,
        mode: state.requestedMode,
        position: state.position,
        tick: tickNumber,
        type: 'player_idle',
        version: PROTOCOL_VERSION,
      };
      broadcast(idle);
    }
    return;
  }
  state.movement = movement;
  const started = {
    characterId: state.characterId,
    direction: movement.direction,
    durationTicks: movement.durationTicks,
    from: movement.fromTile,
    mode: movement.mode,
    movementId: movement.movementId,
    startTick: movement.startTick,
    to: movement.toTile,
    type: 'movement_started',
    version: PROTOCOL_VERSION,
  };
  broadcast(started);
}

function tick(): void {
  tickNumber += 1;
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (state && !state.hunting) {
      updatePlayer(state);
    }
  }
  if (tickNumber % SNAPSHOT_INTERVAL_TICKS === 0) {
    broadcast(createSnapshot(), true);
  }
}

async function persist(socket: Bun.ServerWebSocket<SocketData>): Promise<void> {
  const state = socket.data.authenticated;
  if (!state || !state.dirty) {
    return;
  }
  const characterId = state.characterId;
  const accountId = state.accountId;
  const connectionGeneration = state.connectionGeneration;
  const dirtyVersion = state.dirtyVersion;
  const update = { position_x: state.position.x, position_y: state.position.y };
  const previousPersistence = persistenceByCharacter.get(characterId) ?? Promise.resolve();
  async function persistPosition(): Promise<void> {
    const activeGeneration = connectionGenerationByCharacter.get(characterId);
    if (activeGeneration !== undefined && activeGeneration !== connectionGeneration) {
      return;
    }
    const { error } = await characterPersistenceClient
      .from('characters')
      .update(update)
      .eq('id', characterId)
      .eq('user_id', accountId);
    if (error) {
      const details = { characterId, error };
      logger.error(details, 'failed to persist player position');
      throw error;
    }
    if (state.dirtyVersion === dirtyVersion) {
      state.dirty = false;
    }
  }
  const persistence = previousPersistence.then(persistPosition, persistPosition);
  persistenceByCharacter.set(characterId, persistence);
  await persistence;
  if (persistenceByCharacter.get(characterId) === persistence) {
    persistenceByCharacter.delete(characterId);
  }
}

function close(socket: Bun.ServerWebSocket<SocketData>): void {
  globalThis.clearTimeout(socket.data.authenticationTimer);
  const state = socket.data.authenticated;
  if (!state) {
    return;
  }
  state.input = emptyInput();
  authenticatedSockets.delete(socket);
  if (connectionsByAccount.get(state.accountId) !== socket) {
    persist(socket).catch(logger.error);
    return;
  }
  connectionsByAccount.delete(state.accountId);
  if (connectionGenerationByCharacter.get(state.characterId) === state.connectionGeneration) {
    connectionGenerationByCharacter.delete(state.characterId);
  }
  if (!state.hunting) {
    broadcast(cityPresence(state, 'player_left'));
  }
  persist(socket).catch(logger.error);
}

function pong(socket: Bun.ServerWebSocket<SocketData>): void {
  socket.data.lastPongAt = Date.now();
}

function open(socket: Bun.ServerWebSocket<SocketData>): void {
  function authenticationTimeout(): void {
    if (!socket.data.authenticated) {
      closeWithError(socket, 1008, 'authentication_timeout');
    }
  }
  socket.data.authenticationTimer = globalThis.setTimeout(
    authenticationTimeout,
    config.websocketAuthenticationTimeoutMs,
  );
}

function gameLoop(): void {
  const now = globalThis.performance.now();
  accumulatorMs += Math.min(now - previousLoopTime, TICK_INTERVAL_MS * MAXIMUM_CATCH_UP_TICKS);
  previousLoopTime = now;
  let catchUpTicks = 0;
  while (accumulatorMs >= TICK_INTERVAL_MS && catchUpTicks < MAXIMUM_CATCH_UP_TICKS) {
    tick();
    accumulatorMs -= TICK_INTERVAL_MS;
    catchUpTicks += 1;
  }
}

async function persistAll(): Promise<void> {
  const persistences: Persistences = [];
  for (const socket of authenticatedSockets) {
    persistences.push(persist(socket));
  }
  await Promise.all(persistences);
}

function persistAllInBackground(): void {
  persistAll().catch(logger.error);
}

function heartbeat(): void {
  const now = Date.now();
  for (const socket of authenticatedSockets) {
    if (now - socket.data.lastPongAt > HEARTBEAT_INTERVAL_MS * 2) {
      socket.close(1001, 'heartbeat_timeout');
    } else {
      socket.ping();
    }
  }
}

const gameLoopTimer = globalThis.setInterval(gameLoop, Math.floor(TICK_INTERVAL_MS / 2));
const persistenceTimer = globalThis.setInterval(persistAllInBackground, PERSISTENCE_INTERVAL_MS);
const heartbeatTimer = globalThis.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

function notifyHunt(characterId: string, hunt: HuntState | undefined, endedHuntId?: string): void {
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (state && state.characterId === characterId) {
      if (!hunt && state.hunting) {
        state.hunting = false;
        broadcastExcept(cityPresence(state, 'player_joined'), socket);
        send(socket, createSnapshot());
      }
      sendHuntState(socket, hunt, endedHuntId);
    }
  }
}

setHuntNotifier(notifyHunt);

export function beginGameShutdown(): void {
  isShuttingDown = true;
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (state) {
      state.input = emptyInput();
    }
  }
}

export async function stopGameSimulation(): Promise<void> {
  beginGameShutdown();
  globalThis.clearInterval(gameLoopTimer);
  globalThis.clearInterval(persistenceTimer);
  globalThis.clearInterval(heartbeatTimer);
  await persistAll();
  await Promise.all(persistenceByCharacter.values());
}

export const gameWebSocket: Bun.WebSocketHandler<SocketData> = { close, message, open, pong };
