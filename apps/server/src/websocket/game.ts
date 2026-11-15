import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
/* eslint-disable import/max-dependencies, max-lines, max-lines-per-function, oxsome/no-inline-functions-objects-arrays */

import { config } from '../config.ts';
import { SerialCommandQueue } from '../game/serial-command-queue.ts';
import { logger } from '../logger.ts';
import { CAPTURE_RARITIES, type CaptureRarity } from './capture-items.ts';
import { loadCreatureCollection, type CreatureCollection } from './creature-collection.ts';
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
import { loadHuntResources, type HuntResources } from './hunt-resources.ts';
import {
  configureHuntHealingItem,
  configureHuntWaveRange,
  configureHuntCapture,
  configureHuntAbility,
  switchHuntActiveCreature,
  findAccountHunt,
  findHunt,
  leaveHunt,
  setHuntNotifier,
  startHunt,
  suspendHunt,
  type HuntState,
} from './hunting.ts';
import { isWithinInterest } from './interest.ts';
import {
  recordWebSocketBackpressureDrop,
  recordWebSocketConnectionClosed,
  recordWebSocketReceived,
  recordWebSocketSent,
} from './metrics.ts';
import { createAuthenticatedClient, createServerClient, parseMessage } from './protocol.ts';
import { releaseWebSocketConnection } from './request.ts';

const PROTOCOL_VERSION = 1;
const TICKS_PER_SECOND = 30;
const TICK_INTERVAL_MS = 1_000 / TICKS_PER_SECOND;
const MAXIMUM_CATCH_UP_TICKS = 5;
const WALKING_CARDINAL_DURATION_TICKS = 12;
const RUNNING_CARDINAL_DURATION_TICKS = 8;
const WALKING_DIAGONAL_DURATION_TICKS = Math.round(WALKING_CARDINAL_DURATION_TICKS * Math.SQRT2);
const RUNNING_DIAGONAL_DURATION_TICKS = Math.round(RUNNING_CARDINAL_DURATION_TICKS * Math.SQRT2);
const SNAPSHOT_INTERVAL_TICKS = TICKS_PER_SECOND * 5;
const PERSISTENCE_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const INPUT_TIMEOUT_MS = 2_000;
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
type CityConfigurationQueries = [Promise<CreatureCollection>, Promise<HuntResources>];
type ActiveCreatureRow = { active_creature_id: string | null };
type MessagePayload = { type?: unknown };
const CARDINAL_DIRECTIONS: CardinalDirections = ['down', 'left', 'right', 'up'];
const connectionsByAccount = new Map<string, GameSocket>();
const authenticatedSockets = new Set<GameSocket>();
const connectionGenerationByCharacter = new Map<string, number>();
const commandQueueByCharacter = new SerialCommandQueue();
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
  payload: MessagePayload,
  replaceable = false,
): boolean {
  if (socket.getBufferedAmount() > config.websocketMaximumBufferedBytes) {
    recordWebSocketBackpressureDrop();
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
  const serialized = JSON.stringify(envelope);
  socket.send(serialized);
  const messageType = messagePayloadType(payload);
  const byteLength = Buffer.byteLength(serialized);
  recordWebSocketSent(messageType, byteLength);
  return true;
}

function messagePayloadType(payload: MessagePayload): string {
  return typeof payload.type === 'string' ? payload.type : 'unknown';
}

function containsCharacter(players: PlayerSnapshots, characterId: string): boolean {
  for (const player of players) {
    if (player.characterId === characterId) {
      return true;
    }
  }
  return false;
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

function createSnapshot(observer: AuthenticatedState): object {
  const players: PlayerSnapshots = [];
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (!state || state.hunting || !isWithinInterest(observer.position, state.position)) {
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
  if (!observer.hunting && !containsCharacter(players, observer.characterId)) {
    const player: PlayerSnapshot = {
      characterId: observer.characterId,
      x: observer.position.x,
      y: observer.position.y,
    };
    if (observer.movement) {
      player.movement = movementSnapshot(observer.movement);
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

function broadcastExcept(
  subject: AuthenticatedState,
  payload: object,
  excludedSocket: GameSocket,
): void {
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (
      socket !== excludedSocket &&
      state &&
      !state.hunting &&
      isWithinInterest(state.position, subject.position)
    ) {
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
    .select('id, user_id, position_x, position_y, name, level, gold, avatar_url')
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
    profile: {
      avatarUrl: data.avatar_url,
      gold: data.gold,
      level: data.level,
      name: data.name,
    },
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
    broadcastExcept(state, joined, socket);
  }
  sendHuntState(socket, hunt);
  await sendCreatureCollection(socket, state);
}

async function sendCreatureCollection(
  socket: GameSocket,
  state: AuthenticatedState,
  storagePage?: number,
): Promise<void> {
  const cityConfigurationQueries: CityConfigurationQueries = [
    loadCreatureCollection(state.supabase, state.characterId, storagePage),
    loadHuntResources(state.supabase, state.characterId, 1),
  ];
  const [collection, resources] = await Promise.all(cityConfigurationQueries);
  const activeCreatureId = resources.activeCreatureId;
  const activeCreature = activeCreatureId
    ? resources.creatures.find(function selectedCreature(creature): boolean {
        return creature.id === activeCreatureId;
      })
    : resources.creatures[0];
  const activeSpecies = activeCreature
    ? resources.species[String(activeCreature.speciesId)]
    : undefined;
  const configuration =
    activeCreature && activeSpecies
      ? {
          activeCreatureAbilities: activeCreature.abilities.map(function ability(abilityResource) {
            return {
              accuracy: abilityResource.accuracy,
              areaRadius: abilityResource.areaRadius,
              category: abilityResource.category,
              cooldownEndsAt: 0,
              cooldownMs: abilityResource.cooldownMs,
              element: abilityResource.typeSlug,
              id: abilityResource.id,
              name: abilityResource.name,
              power: abilityResource.power,
              range: abilityResource.rangeTiles,
              requiredLevel: abilityResource.requiredLevel,
              slot: abilityResource.slot,
            };
          }),
          activeCreatureAvailableAbilities: activeSpecies.abilities.map(
            function ability(abilityResource) {
              return {
                accuracy: abilityResource.accuracy,
                areaRadius: abilityResource.areaRadius,
                category: abilityResource.category,
                cooldownMs: abilityResource.cooldownMs,
                element: abilityResource.typeSlug,
                id: abilityResource.id,
                name: abilityResource.name,
                power: abilityResource.power,
                range: abilityResource.rangeTiles,
                requiredLevel: abilityResource.requiredLevel,
              };
            },
          ),
          activeCreatureLevel: activeCreature.level,
          captureConfiguration: resources.captureConfiguration,
          captureItems: resources.captureItems,
          healingConfiguration: resources.healingConfiguration,
          healingItemCooldownEndsAt: 0,
          healingItems: resources.healingItems,
        }
      : undefined;
  collection.configuration = configuration;
  send(socket, { collection, type: 'collection_state', version: PROTOCOL_VERSION });
}

async function requestCreatureStorage(
  socket: GameSocket,
  state: AuthenticatedState,
  clientMessage: ClientMessage,
): Promise<void> {
  if (
    typeof clientMessage.storagePage !== 'number' ||
    !Number.isSafeInteger(clientMessage.storagePage) ||
    clientMessage.storagePage < 1
  ) {
    throw new TypeError('invalid_storage_page');
  }
  await sendCreatureCollection(socket, state, clientMessage.storagePage);
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
    return;
  }
  const itemId = clientMessage.healingItemId;
  const cityHealingUpdate = {
    character_id: state.characterId,
    item_id: itemId,
    threshold_percentage: clientMessage.healingThresholdPercentage,
  };
  const cityHealingRequest =
    itemId === 0
      ? characterPersistenceClient
          .from('character_battle_item_configuration')
          .delete()
          .eq('character_id', state.characterId)
      : characterPersistenceClient
          .from('character_battle_item_configuration')
          .upsert(cityHealingUpdate);
  const { error } = await cityHealingRequest;
  if (error) {
    throw error;
  }
  await sendCreatureCollection(socket, state);
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
    return;
  }
  const { data, error: characterError } = await characterPersistenceClient
    .from('characters')
    .select('active_creature_id')
    .eq('id', state.characterId)
    .single<ActiveCreatureRow>();
  const activeCreatureId = data ? data.active_creature_id : null;
  if (characterError || !activeCreatureId) {
    throw characterError ?? new TypeError('active_creature_missing');
  }
  const parameters = {
    target_creature_id: activeCreatureId,
    target_move_id: clientMessage.abilityId,
    target_slot: clientMessage.abilitySlot,
  };
  const { error } = await createServerClient().rpc('configure_creature_equipped_move', parameters);
  if (error) {
    throw error;
  }
  await sendCreatureCollection(socket, state);
}

async function configureWaveRange(
  socket: GameSocket,
  state: AuthenticatedState,
  clientMessage: ClientMessage,
): Promise<void> {
  if (
    typeof clientMessage.waveRangeMinimumSize !== 'number' ||
    !Number.isSafeInteger(clientMessage.waveRangeMinimumSize) ||
    typeof clientMessage.waveRangeMaximumSize !== 'number' ||
    !Number.isSafeInteger(clientMessage.waveRangeMaximumSize)
  ) {
    throw new TypeError('invalid_wave_range');
  }
  const hunt = await configureHuntWaveRange(
    state.characterId,
    state.accountId,
    clientMessage.waveRangeMinimumSize,
    clientMessage.waveRangeMaximumSize,
  );
  if (hunt) {
    sendHuntState(socket, hunt);
  }
}

async function switchActiveCreature(
  socket: GameSocket,
  state: AuthenticatedState,
  clientMessage: ClientMessage,
): Promise<void> {
  if (typeof clientMessage.creatureId !== 'string') {
    throw new TypeError('invalid_creature');
  }
  const hunt = await switchHuntActiveCreature(
    state.characterId,
    state.accountId,
    clientMessage.creatureId,
  );
  if (hunt) {
    sendHuntState(socket, hunt);
    return;
  }
  const parameters = {
    target_character_id: state.characterId,
    target_creature_id: clientMessage.creatureId,
  };
  const { error } = await createServerClient().rpc('select_active_creature', parameters);
  if (error) {
    throw error;
  }
  await sendCreatureCollection(socket, state);
}

// The operation stays together so validation and its resulting collection snapshot remain coupled.
// eslint-disable-next-line max-lines-per-function
async function moveCreature(
  socket: GameSocket,
  state: AuthenticatedState,
  clientMessage: ClientMessage,
): Promise<void> {
  if (typeof clientMessage.creatureId !== 'string') {
    throw new TypeError('invalid_creature');
  }
  const creatureId = clientMessage.creatureId;
  if (clientMessage.type === 'move_creature_to_storage') {
    const moveToStorageParams = { target_creature_id: creatureId };
    const { error } = await state.supabase.rpc('move_creature_to_storage', moveToStorageParams);
    if (error) {
      throw error;
    }
    await sendCreatureCollection(socket, state);
    return;
  }
  const moveToPartyParams = { target_creature_id: creatureId };
  const { error } = await state.supabase.rpc('move_creature_to_party', moveToPartyParams);
  if (error) {
    throw error;
  }
  await sendCreatureCollection(socket, state);
}

type CaptureRarities = Array<CaptureRarity>;
function isValidCaptureRarity(rarity: unknown): boolean {
  return typeof rarity === 'string' && CAPTURE_RARITIES.includes(rarity as CaptureRarity);
}

function isCaptureRarities(value: unknown): value is CaptureRarities {
  return Array.isArray(value) && value.length > 0 && value.every(isValidCaptureRarity);
}

async function configureCapture(
  socket: GameSocket,
  state: AuthenticatedState,
  clientMessage: ClientMessage,
): Promise<void> {
  if (
    typeof clientMessage.captureItemId !== 'number' ||
    !Number.isSafeInteger(clientMessage.captureItemId) ||
    (clientMessage.captureItemId !== 0 && !isCaptureRarities(clientMessage.captureRarities))
  ) {
    throw new TypeError('invalid_capture_configuration');
  }
  const rarities = clientMessage.captureItemId === 0 ? [] : clientMessage.captureRarities;
  const hunt = await configureHuntCapture(
    state.characterId,
    state.accountId,
    clientMessage.captureItemId,
    rarities,
  );
  if (hunt) {
    sendHuntState(socket, hunt);
    return;
  }
  const itemId = clientMessage.captureItemId;
  const cityCaptureUpdate = {
    character_id: state.characterId,
    item_id: itemId,
    rarities,
  };
  const cityCaptureRequest =
    itemId === 0
      ? characterPersistenceClient
          .from('character_capture_configuration')
          .delete()
          .eq('character_id', state.characterId)
      : characterPersistenceClient
          .from('character_capture_configuration')
          .upsert(cityCaptureUpdate);
  const { error } = await cityCaptureRequest;
  if (error) {
    throw error;
  }
  await sendCreatureCollection(socket, state);
}

async function handleStartHunt(
  socket: GameSocket,
  state: AuthenticatedState,
  huntingLocationId: unknown,
): Promise<void> {
  if (state.hunting) {
    sendHuntState(socket, await findHunt(state.characterId));
    return;
  }
  state.input = emptyInput();
  state.movement = undefined;
  await persist(socket);
  if (
    typeof huntingLocationId !== 'number' ||
    !Number.isSafeInteger(huntingLocationId) ||
    huntingLocationId < 1
  ) {
    throw new Error('invalid_hunting_location');
  }
  const hunt = await startHunt(state.characterId, state.accountId, huntingLocationId);
  state.hunting = true;
  const left = cityPresence(state, 'player_left');
  broadcastExcept(state, left, socket);
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
  const joined = cityPresence(state, 'player_joined');
  broadcastExcept(state, joined, socket);
  send(socket, createSnapshot(state));
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
  if (clientMessage.type === 'configure_capture') {
    await configureCapture(socket, state, clientMessage);
    return true;
  }
  if (clientMessage.type === 'configure_wave_range') {
    await configureWaveRange(socket, state, clientMessage);
    return true;
  }
  if (clientMessage.type === 'switch_active_creature') {
    await switchActiveCreature(socket, state, clientMessage);
    return true;
  }
  if (clientMessage.type === 'request_creature_storage') {
    await requestCreatureStorage(socket, state, clientMessage);
    return true;
  }
  if (
    clientMessage.type === 'move_creature_to_party' ||
    clientMessage.type === 'move_creature_to_storage'
  ) {
    await moveCreature(socket, state, clientMessage);
    return true;
  }
  if (clientMessage.type !== 'start_hunt' && clientMessage.type !== 'leave_hunt') {
    return false;
  }
  state.huntTransitioning = true;
  try {
    if (clientMessage.type === 'start_hunt') {
      await handleStartHunt(socket, state, clientMessage.huntingLocationId);
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

async function processAuthenticatedMessage(
  socket: GameSocket,
  parsed: ClientMessage,
): Promise<void> {
  if (handleHuntClock(socket, parsed)) {
    return;
  }
  const activeState = socket.data.authenticated;
  if (activeState && activeState.huntTransitioning) {
    if (parsed.type === 'input') {
      handleInput(socket, parsed);
    } else {
      send(socket, { code: 'hunt_transitioning', type: 'error', version: PROTOCOL_VERSION });
    }
    return;
  }
  try {
    const state = socket.data.authenticated;
    if (!state) {
      return;
    }
    const handled = await commandQueueByCharacter.run(
      state.characterId,
      function processCharacterCommand(): Promise<boolean> {
        return handleHuntCommand(socket, parsed);
      },
    );
    if (!handled) {
      handleInput(socket, parsed);
    }
  } catch (error) {
    const state = socket.data.authenticated;
    const details = { characterId: state ? state.characterId : undefined, error };
    logger.error(details, 'hunt command failed');
    send(socket, { code: 'hunt_command_failed', type: 'error', version: PROTOCOL_VERSION });
  }
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
  const messageType = typeof parsed.type === 'string' ? parsed.type : 'unknown';
  recordWebSocketReceived(messageType, rawMessage.length);
  if (socket.data.authenticated) {
    await processAuthenticatedMessage(socket, parsed);
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

function broadcast(subject: AuthenticatedState, payload: object, replaceable = false): void {
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (
      state &&
      !state.hunting &&
      !state.huntTransitioning &&
      isWithinInterest(state.position, subject.position)
    ) {
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
      broadcast(state, idle);
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
  broadcast(state, started);
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
    for (const socket of authenticatedSockets) {
      const state = socket.data.authenticated;
      if (state && !state.hunting && !state.huntTransitioning) {
        send(socket, createSnapshot(state), true);
      }
    }
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
  releaseWebSocketConnection(socket.data.ipAddress);
  recordWebSocketConnectionClosed();
  const state = socket.data.authenticated;
  if (!state) {
    return;
  }
  state.input = emptyInput();
  authenticatedSockets.delete(socket);
  if (connectionsByAccount.get(state.accountId) !== socket) {
    persist(socket).catch(logPersistenceError);
    return;
  }
  connectionsByAccount.delete(state.accountId);
  if (connectionGenerationByCharacter.get(state.characterId) === state.connectionGeneration) {
    connectionGenerationByCharacter.delete(state.characterId);
  }
  if (!state.hunting) {
    const left = cityPresence(state, 'player_left');
    broadcast(state, left);
  }
  persist(socket).catch(logPersistenceError);
  suspendHunt(state.characterId).catch(logHuntSuspensionError);
}

function logHuntSuspensionError(error: unknown): void {
  const details = { error };
  logger.error(details, 'failed to suspend hunt after socket close');
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
  persistAll().catch(logPersistenceError);
}

function logPersistenceError(error: unknown): void {
  const details = { error };
  logger.error(details, 'failed to persist game state');
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

function notifyHunt(
  characterId: string,
  hunt: HuntState | undefined,
  endedHuntId?: string,
  collectionChanged = false,
): void {
  for (const socket of authenticatedSockets) {
    const state = socket.data.authenticated;
    if (state && state.characterId === characterId) {
      if (!hunt && state.hunting) {
        state.hunting = false;
        const joined = cityPresence(state, 'player_joined');
        broadcastExcept(state, joined, socket);
        send(socket, createSnapshot(state));
      }
      sendHuntState(socket, hunt, endedHuntId);
      if (collectionChanged) {
        sendCreatureCollection(socket, state).catch(logCreatureCollectionError);
      }
    }
  }
}

function logCreatureCollectionError(error: unknown): void {
  const details = { error };
  logger.error(details, 'failed to send creature collection');
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
