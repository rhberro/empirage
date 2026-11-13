/* eslint-disable complexity, func-style, max-lines, max-lines-per-function, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types, sort-keys */
import { randomUUID } from 'node:crypto';

import { logger } from '../logger.ts';
import type { Movement, Position } from './game-types.ts';
import { writeHuntCheckpoint, type HuntCheckpointRequest } from './hunt-checkpoints.ts';
import {
  advanceEngine,
  applyHealingItem,
  createEngine,
  healingItemCooldownEndsAt,
  healingItemDue,
  pauseEngine,
  resumeEngine,
  snapshotEngine,
  type HuntCombatEvent,
  type HuntEngine,
  type HuntEngineCheckpoint,
  type HuntEngineEnemy,
  type HuntEngineSnapshot,
} from './hunt-engine.ts';
import {
  loadHuntResources,
  type HealingConfigurationResource,
  type HealingItemResource,
  type HuntAbilityResource,
  type HuntCreatureResource,
  type HuntResources,
} from './hunt-resources.ts';
import { createServerClient } from './protocol.ts';

const CHECKPOINT_INTERVAL_MS = 3_000;
const MAXIMUM_UNCONFIRMED_MS = 5_000;
const RETRY_INTERVAL_MS = 1_000;
const STOP_TIMEOUT_MS = 10_000;
const FINISH_WAIT_TIMEOUT_MS = 5_000;
const BOOTSTRAP_RETRY_MS = 1_000;
const BOOTSTRAP_BATCH_SIZE = 25;
const TICK_INTERVAL_MS = Math.floor(1_000 / 30);
const ALLY_POSITION: Position = { x: 6, y: 3 };
const PLAYER_POSITION: Position = { x: 2, y: 3 };
const GRID_HEIGHT = 8;
const GRID_WIDTH = 12;

type Notify = (characterId: string, state: HuntState | undefined, endedHuntId?: string) => void;
type RuntimeStatus = 'conflict' | 'finishing' | 'paused' | 'running';
type PublicEnemy = {
  base_attack: number;
  base_defense: number;
  base_health: number;
  base_speed: number;
  combatId: string;
  health: number;
  id: number;
  level: number;
  maximumHealth: number;
  movement?: HuntEngineEnemy['movement'];
  name: string;
  nextAttackAt: number;
  position: Position;
};
type PublicEnemies = Array<PublicEnemy>;
type PublicActiveCreatureAbility = {
  accuracy: number | null;
  areaRadius: number;
  category: HuntAbilityResource['category'];
  cooldownEndsAt: number;
  cooldownMs: number;
  element: string;
  id: number;
  name: string;
  power: number | null;
  range: number;
  requiredLevel: number;
  slot: number;
};
type PublicActiveCreatureAbilities = Array<PublicActiveCreatureAbility>;
type PublicHealingItem = {
  goldCost: number;
  healingAmount: number;
  id: number;
  name: string;
  restoresFullHealth: boolean;
  slug: string;
};
type PublicHealingItems = Array<PublicHealingItem>;
type PublicHealingConfiguration = {
  itemId: number;
  thresholdPercentage: number;
};
type HuntGrid = { blocked: Array<Position>; height: number; tileSize: number; width: number };
type HuntDatabaseRow = {
  ability_cooldowns: Record<string, Record<string, number>>;
  active_creature_health: number;
  active_creature_id: string;
  character_id: string;
  combat_events: Array<HuntCombatEvent>;
  enemies: Array<unknown>;
  hunt_id: string;
  hunting_location_id: number;
  next_event_at: string;
  player_position: Position;
  revision: number;
  runtime_snapshot: unknown;
  user_id: string;
  wave: number;
  wave_delay_seconds: number;
  wave_size: number;
};
type AccountHunt = { character_id: string };
type PendingCheckpoint = {
  fallbackActiveCreatureId?: string;
  finishHunt: boolean;
  request: HuntCheckpointRequest;
  retryAt: number;
};
type Runtime = {
  accountId: string;
  characterId: string;
  checkpoint?: PendingCheckpoint;
  engine: HuntEngine;
  finalizePromise?: Promise<boolean>;
  finalizeResolve?: (finished: boolean) => void;
  healingUsePending?: Promise<void>;
  lastConfirmedCapture: number;
  lastValidActiveCreatureId: string;
  notifyOnFinish: boolean;
  remoteRevision: number;
  status: RuntimeStatus;
};
type RuntimeSnapshotInput = HuntEngineCheckpoint & { runtimeGeneration: string; version: 1 };

export type HuntState = {
  activeCreatureAbilities: PublicActiveCreatureAbilities;
  activeCreatureAvailableAbilities: PublicActiveCreatureAbilities;
  activeCreatureHealth: number;
  activeCreatureId: string;
  activeCreatureLevel: number;
  activeCreatureMaximumHealth: number;
  activeCreatureSpeciesId: number | null;
  allyPosition: Position;
  combatEvents: Array<HuntCombatEvent>;
  enemies: PublicEnemies;
  grid: HuntGrid;
  gold: number;
  healingConfiguration?: PublicHealingConfiguration;
  healingItemCooldownEndsAt: number;
  healingItems: PublicHealingItems;
  huntingLocationId: number;
  huntId: string;
  nextEventAt: string;
  playerPosition: Position;
  revision: number;
  runtimeGeneration: string;
  serverTime: number;
  wave: number;
  waveSize: number;
};

const serverClient = createServerClient();
const runtimesByCharacter = new Map<string, Runtime>();
const runtimesByHunt = new Map<string, Runtime>();
const runtimesByAccount = new Map<string, Runtime>();
const recoveryFlights = new Map<string, Promise<Runtime | undefined>>();
const startFlightsByCharacter = new Map<string, Promise<HuntState>>();
const startFlightsByAccount = new Map<string, Promise<HuntState>>();
const epochOrigin = Date.now() - globalThis.performance.now();
let acceptingHunts = false;
let bootstrapTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
let notifier: Notify | undefined;
let stopComplete = false;
let shutdownRequested = false;
let tickTimer: ReturnType<typeof globalThis.setInterval> | undefined;

function epochNow(): number {
  return Math.floor(epochOrigin + globalThis.performance.now());
}

function delay(milliseconds: number): Promise<void> {
  function executor(resolve: () => void): void {
    globalThis.setTimeout(resolve, milliseconds);
  }
  return new Promise(executor);
}

async function finishTimeout(): Promise<boolean> {
  await delay(FINISH_WAIT_TIMEOUT_MS);
  throw new Error('hunt_finish_pending');
}

function huntGrid(locationId: number): HuntGrid {
  const blocked: Array<Position> = [];
  for (let x = 2; x < GRID_WIDTH - 2; x += 2) {
    if (x !== ALLY_POSITION.x) {
      blocked.push({ x, y: 1 + ((x * 3 + locationId) % (GRID_HEIGHT - 2)) });
    }
  }
  return { blocked, height: GRID_HEIGHT, tileSize: 16, width: GRID_WIDTH };
}

function publicEnemy(enemy: HuntEngineEnemy): PublicEnemy {
  return {
    base_attack: enemy.baseAttack,
    base_defense: enemy.baseDefense,
    base_health: enemy.baseHealth,
    base_speed: enemy.baseSpeed,
    combatId: enemy.combatId,
    health: enemy.health,
    id: enemy.id,
    level: enemy.level,
    maximumHealth: enemy.maximumHealth,
    movement: enemy.movement,
    name: enemy.name,
    nextAttackAt: enemy.nextAttackAt,
    position: enemy.position,
  };
}

function publicHealingItem(item: HealingItemResource): PublicHealingItem {
  return {
    goldCost: item.goldCost,
    healingAmount: item.healingAmount,
    id: item.id,
    name: item.name,
    restoresFullHealth: item.restoresFullHealth,
    slug: item.slug,
  };
}

function publicHealingConfiguration(
  configuration: HealingConfigurationResource | undefined,
): PublicHealingConfiguration | undefined {
  return configuration
    ? {
        itemId: configuration.itemId,
        thresholdPercentage: configuration.thresholdPercentage,
      }
    : undefined;
}

function publicState(runtime: Runtime, combatEvents: Array<HuntCombatEvent>): HuntState {
  const { engine } = runtime;
  const active = engine.allies[engine.activeAllyIndex];
  const enemies = engine.enemies.map(publicEnemy);
  const activeCreatureAbilities = active
    ? active.abilities.map(function publicAbility(ability): PublicActiveCreatureAbility {
        return publicAbilityResource(ability, ability.slot, engine.abilityCooldowns[active.id]);
      })
    : [];
  const activeSpecies = active ? engine.resources.species[String(active.speciesId)] : undefined;
  const activeCreatureAvailableAbilities =
    active && activeSpecies
      ? activeSpecies.abilities.map(
          function publicAvailableAbility(ability): PublicActiveCreatureAbility {
            return publicAbilityResource(ability, 0);
          },
        )
      : [];
  return {
    activeCreatureAbilities,
    activeCreatureAvailableAbilities,
    activeCreatureHealth: active ? active.health : 0,
    activeCreatureId: active ? active.id : runtime.lastValidActiveCreatureId,
    activeCreatureLevel: active ? active.level : 1,
    activeCreatureMaximumHealth: active ? active.maximumHealth : 1,
    activeCreatureSpeciesId: active ? active.speciesId : null,
    allyPosition: ALLY_POSITION,
    combatEvents,
    enemies,
    gold: engine.resources.gold,
    grid: huntGrid(engine.resources.locationId),
    healingConfiguration: publicHealingConfiguration(engine.resources.healingConfiguration),
    healingItemCooldownEndsAt: healingItemCooldownEndsAt(engine),
    healingItems: engine.resources.healingItems.map(publicHealingItem),
    huntingLocationId: engine.resources.locationId,
    huntId: engine.huntId,
    nextEventAt: new Date(engine.nextEventAt).toISOString(),
    playerPosition: engine.playerPosition,
    revision: engine.revision,
    runtimeGeneration: engine.runtimeGeneration,
    serverTime: Date.now(),
    wave: engine.wave,
    waveSize: engine.waveSize,
  };
}

function publicAbilityResource(
  ability: HuntAbilityResource,
  slot: number,
  cooldowns: Record<string, number> | undefined,
): PublicActiveCreatureAbility {
  const range = ability.category === 'physical' ? 1 : 4;
  return {
    accuracy: ability.accuracy,
    areaRadius: ability.isFire ? 1 : 0,
    category: ability.category,
    cooldownEndsAt: cooldowns ? (cooldowns[String(ability.id)] ?? 0) : 0,
    cooldownMs: ability.cooldownMs,
    element: ability.typeSlug,
    id: ability.id,
    name: ability.name,
    power: ability.power,
    range,
    requiredLevel: ability.requiredLevel,
    slot,
  };
}

function notifyRuntime(runtime: Runtime, events: Array<HuntCombatEvent>): void {
  if (notifier) {
    notifier(runtime.characterId, publicState(runtime, events));
  }
}

function installRuntime(runtime: Runtime): void {
  runtimesByCharacter.set(runtime.characterId, runtime);
  runtimesByHunt.set(runtime.engine.huntId, runtime);
  runtimesByAccount.set(runtime.accountId, runtime);
}

function removeRuntime(runtime: Runtime): void {
  runtimesByCharacter.delete(runtime.characterId);
  runtimesByHunt.delete(runtime.engine.huntId);
  runtimesByAccount.delete(runtime.accountId);
}

function subtractConfirmedExperience(engine: HuntEngine, snapshot: HuntEngineSnapshot): void {
  for (const [creatureId, captured] of Object.entries(snapshot.xpPending)) {
    const current = engine.xpPending[creatureId] ?? 0;
    const remaining = current - captured;
    if (remaining > 0) {
      engine.xpPending[creatureId] = remaining;
    } else {
      engine.xpPending[creatureId] = 0;
    }
  }
}

function checkpointRequest(runtime: Runtime, finishHunt: boolean): PendingCheckpoint {
  const snapshot = snapshotEngine(runtime.engine, epochNow());
  const request: HuntCheckpointRequest = {
    checkpointId: randomUUID(),
    expectedRevision: runtime.remoteRevision,
    fallbackActiveCreatureId: finishHunt ? runtime.lastValidActiveCreatureId : undefined,
    finishHunt,
    snapshot,
  };
  return {
    fallbackActiveCreatureId: request.fallbackActiveCreatureId,
    finishHunt,
    request,
    retryAt: 0,
  };
}

function logCheckpointFailure(runtime: Runtime, error: unknown): void {
  const details = { characterId: runtime.characterId, error, huntId: runtime.engine.huntId };
  logger.error(details, 'hunt checkpoint failed; stable checkpoint will retry');
}

async function performCheckpoint(runtime: Runtime, pending: PendingCheckpoint): Promise<void> {
  try {
    const result = await writeHuntCheckpoint(serverClient, pending.request);
    if (runtime.checkpoint !== pending) {
      return;
    }
    if (!result.applied || result.nextRevision === null) {
      runtime.status = 'conflict';
      if (runtime.finalizeResolve) {
        runtime.finalizeResolve(false);
      }
      const details = {
        characterId: runtime.characterId,
        expectedRevision: pending.request.expectedRevision,
        huntId: runtime.engine.huntId,
      };
      logger.error(details, 'hunt checkpoint revision conflict; runtime frozen');
      return;
    }
    subtractConfirmedExperience(runtime.engine, pending.request.snapshot);
    runtime.lastConfirmedCapture = pending.request.snapshot.capturedAt;
    runtime.remoteRevision = result.nextRevision;
    runtime.checkpoint = undefined;
    if (pending.finishHunt && result.finished) {
      removeRuntime(runtime);
      if (runtime.finalizeResolve) {
        runtime.finalizeResolve(true);
      }
      if (notifier && runtime.notifyOnFinish) {
        notifier(runtime.characterId, undefined, runtime.engine.huntId);
      }
      return;
    }
    if (runtime.status === 'finishing') {
      launchCheckpoint(runtime, true);
      return;
    }
    const now = epochNow();
    if (now - runtime.lastConfirmedCapture <= MAXIMUM_UNCONFIRMED_MS) {
      if (runtime.status === 'paused' && acceptingHunts) {
        resumeEngine(runtime.engine, now);
        runtime.status = 'running';
        notifyRuntime(runtime, []);
      }
      return;
    }
    if (runtime.status !== 'finishing') {
      runtime.status = 'paused';
      pauseEngine(runtime.engine, now);
      notifyRuntime(runtime, []);
      launchCheckpoint(runtime, false);
    }
  } catch (error) {
    if (runtime.checkpoint === pending) {
      pending.retryAt = epochNow() + RETRY_INTERVAL_MS;
      logCheckpointFailure(runtime, error);
    }
  }
}

function launchCheckpoint(runtime: Runtime, finishHunt: boolean): void {
  if (runtime.checkpoint || runtime.status === 'conflict') {
    return;
  }
  const pending = checkpointRequest(runtime, finishHunt);
  runtime.checkpoint = pending;
  performCheckpoint(runtime, pending).catch(function unexpected(error: unknown): void {
    logCheckpointFailure(runtime, error);
  });
}

function processRuntime(runtime: Runtime, now: number): void {
  const pending = runtime.checkpoint;
  if (pending && pending.retryAt > 0 && pending.retryAt <= now) {
    pending.retryAt = Number.POSITIVE_INFINITY;
    performCheckpoint(runtime, pending).catch(function unexpected(error: unknown): void {
      logCheckpointFailure(runtime, error);
    });
  }
  if (runtime.status === 'conflict' || runtime.status === 'finishing') {
    return;
  }
  if (now - runtime.lastConfirmedCapture > MAXIMUM_UNCONFIRMED_MS) {
    if (runtime.status !== 'paused') {
      pauseEngine(runtime.engine, now);
      runtime.status = 'paused';
      notifyRuntime(runtime, []);
    }
    if (!runtime.checkpoint) {
      launchCheckpoint(runtime, false);
    }
    return;
  }
  if (runtime.status !== 'running') {
    return;
  }
  const result = advanceEngine(runtime.engine, now);
  if (result.changed) {
    const active = runtime.engine.allies[runtime.engine.activeAllyIndex];
    if (active) {
      runtime.lastValidActiveCreatureId = active.id;
    }
    notifyRuntime(runtime, result.combatEvents);
  }
  queueHealingItemUse(runtime, now);
  if (result.finished) {
    runtime.notifyOnFinish = true;
    runtime.status = 'finishing';
    launchCheckpoint(runtime, true);
    return;
  }
  if (!runtime.checkpoint && now - runtime.lastConfirmedCapture >= CHECKPOINT_INTERVAL_MS) {
    launchCheckpoint(runtime, false);
  }
}

type HealingItemPurchaseRow = { gold: number; healing_amount: number };

function queueHealingItemUse(runtime: Runtime, now: number): void {
  if (runtime.healingUsePending || !healingItemDue(runtime.engine, now)) {
    return;
  }
  const configuration = runtime.engine.resources.healingConfiguration;
  if (!configuration) {
    return;
  }
  const item = runtime.engine.resources.healingItems.find(function configuredItem(
    candidate: HealingItemResource,
  ): boolean {
    return candidate.id === configuration.itemId;
  });
  if (!item) {
    return;
  }
  const params = { target_character_id: runtime.characterId, target_item_id: item.id };
  async function purchaseAndApply(): Promise<void> {
    const { data, error } = await serverClient.rpc('use_character_healing_item', params);
    if (error) {
      throw error;
    }
    const rows = data as Array<HealingItemPurchaseRow>;
    const purchase = rows[0];
    if (!purchase || runtime.status !== 'running') {
      return;
    }
    runtime.engine.resources.gold = purchase.gold;
    if (applyHealingItem(runtime.engine, purchase.healing_amount, epochNow())) {
      notifyRuntime(runtime, []);
    }
  }
  const pending = purchaseAndApply();
  runtime.healingUsePending = pending;
  function clearPending(): void {
    if (runtime.healingUsePending === pending) {
      runtime.healingUsePending = undefined;
    }
  }
  pending.then(clearPending, function healingUseFailed(error: unknown): void {
    clearPending();
    const details = { characterId: runtime.characterId, error, huntId: runtime.engine.huntId };
    logger.error(details, 'healing item purchase failed');
  });
}

export async function configureHuntHealingItem(
  characterId: string,
  userId: string,
  itemId: number,
  thresholdPercentage: number,
): Promise<HuntState | undefined> {
  if (
    !Number.isSafeInteger(itemId) ||
    itemId < 0 ||
    !Number.isSafeInteger(thresholdPercentage) ||
    thresholdPercentage < 1 ||
    thresholdPercentage > 100
  ) {
    throw new TypeError('invalid_healing_configuration');
  }
  const runtime = await runtimeForCharacter(characterId);
  if (!runtime || runtime.accountId !== userId) {
    return undefined;
  }
  if (itemId === 0) {
    const update = { healing_item_id: null, healing_threshold_percentage: null };
    const { error } = await serverClient
      .from('characters')
      .update(update)
      .eq('id', characterId)
      .eq('user_id', userId);
    if (error) {
      throw error;
    }
    runtime.engine.resources.healingConfiguration = undefined;
    const state = publicState(runtime, []);
    notifyRuntime(runtime, []);
    return state;
  }
  const item = runtime.engine.resources.healingItems.find(function configuredItem(
    candidate: HealingItemResource,
  ): boolean {
    return candidate.id === itemId;
  });
  if (!item) {
    throw new TypeError('invalid_healing_item');
  }
  const update = {
    healing_item_id: itemId,
    healing_threshold_percentage: thresholdPercentage,
  };
  const { error } = await serverClient
    .from('characters')
    .update(update)
    .eq('id', characterId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
  runtime.engine.resources.healingConfiguration = { itemId, thresholdPercentage };
  const state = publicState(runtime, []);
  notifyRuntime(runtime, []);
  return state;
}

export async function configureHuntAbility(
  characterId: string,
  userId: string,
  slot: number,
  abilityId: number | null,
): Promise<HuntState | undefined> {
  if (!Number.isSafeInteger(slot) || slot < 1 || slot > 4) {
    throw new TypeError('invalid_ability_slot');
  }
  if (abilityId !== null && (!Number.isSafeInteger(abilityId) || abilityId < 1)) {
    throw new TypeError('invalid_ability');
  }
  const runtime = await runtimeForCharacter(characterId);
  if (!runtime || runtime.accountId !== userId) {
    return undefined;
  }
  const active = runtime.engine.allies[runtime.engine.activeAllyIndex];
  if (!active) {
    throw new TypeError('active_creature_missing');
  }
  const species = runtime.engine.resources.species[String(active.speciesId)];
  if (!species) {
    throw new TypeError('active_creature_species_missing');
  }
  const selected =
    abilityId === null
      ? undefined
      : species.abilities.find(function selectedAbility(ability: HuntAbilityResource): boolean {
          return ability.id === abilityId;
        });
  if (abilityId !== null && (!selected || selected.requiredLevel > active.level)) {
    throw new TypeError('ability_is_not_available');
  }
  const current = active.abilities.find(function abilityAtSlot(
    ability: HuntAbilityResource,
  ): boolean {
    return ability.slot === slot;
  });
  if (current && current.id === abilityId) {
    return publicState(runtime, []);
  }
  const parameters = {
    target_ability_id: abilityId,
    target_creature_id: active.id,
    target_slot: slot,
  };
  const { error } = await serverClient.rpc('configure_creature_equipped_ability', parameters);
  if (error) {
    throw error;
  }
  const abilities = active.abilities.filter(function excludingChangedSlots(
    ability: HuntAbilityResource,
  ): boolean {
    return ability.slot !== slot && ability.id !== abilityId;
  });
  if (selected) {
    abilities.push({ ...selected, slot });
    const cooldowns = runtime.engine.abilityCooldowns[active.id] ?? {};
    cooldowns[String(selected.id)] = epochNow() + selected.cooldownMs;
    runtime.engine.abilityCooldowns[active.id] = cooldowns;
  }
  abilities.sort(function bySlot(first: HuntAbilityResource, second: HuntAbilityResource): number {
    return first.slot - second.slot;
  });
  active.abilities = abilities;
  const resourceCreature = runtime.engine.resources.creatures.find(function resourceForActive(
    creature: HuntCreatureResource,
  ): boolean {
    return creature.id === active.id;
  });
  if (resourceCreature) {
    resourceCreature.abilities = abilities;
  }
  const state = publicState(runtime, []);
  notifyRuntime(runtime, []);
  return state;
}

function simulationTick(): void {
  const now = epochNow();
  for (const runtime of runtimesByCharacter.values()) {
    const engineBeforeTick = globalThis.structuredClone(runtime.engine);
    try {
      processRuntime(runtime, now);
    } catch (error) {
      runtime.engine = engineBeforeTick;
      runtime.status = 'conflict';
      const details = { characterId: runtime.characterId, error, huntId: runtime.engine.huntId };
      logger.error(details, 'hunt simulation failed; runtime frozen');
    }
  }
}

function ensureSimulation(): void {
  if (!tickTimer) {
    tickTimer = globalThis.setInterval(simulationTick, TICK_INTERVAL_MS);
  }
}

async function bootstrapHunts(): Promise<void> {
  let offset = 0;
  while (true) {
    if (acceptingHunts || shutdownRequested) {
      return;
    }
    const { data, error } = await serverClient
      .from('character_hunts')
      .select('character_id')
      .order('character_id')
      .range(offset, offset + BOOTSTRAP_BATCH_SIZE - 1);
    if (error) {
      throw error;
    }
    const rows = data as Array<AccountHunt>;
    for (const row of rows) {
      await runtimeForCharacter(row.character_id);
    }
    if (rows.length < BOOTSTRAP_BATCH_SIZE) {
      acceptingHunts = true;
      logger.info('existing hunts bootstrapped into memory');
      return;
    }
    offset += BOOTSTRAP_BATCH_SIZE;
  }
}

function scheduleBootstrap(): void {
  if (shutdownRequested || acceptingHunts) {
    return;
  }
  bootstrapHunts().catch(function bootstrapFailed(error: unknown): void {
    logger.error({ error }, 'hunt bootstrap failed; admissions remain closed');
    if (!shutdownRequested && !bootstrapTimer) {
      bootstrapTimer = globalThis.setTimeout(function retryBootstrap(): void {
        bootstrapTimer = undefined;
        scheduleBootstrap();
      }, BOOTSTRAP_RETRY_MS);
    }
  });
}

function safeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value as number;
}

function position(value: unknown, name: string): Position {
  if (!value || typeof value !== 'object') {
    throw new TypeError(`Invalid ${name}`);
  }
  const candidate = value as Record<string, unknown>;
  return { x: safeInteger(candidate.x, `${name}.x`), y: safeInteger(candidate.y, `${name}.y`) };
}

function legacyEnemies(
  rows: Array<unknown>,
  resources: HuntResources,
  now: number,
): Array<HuntEngineEnemy> {
  const enemies: Array<HuntEngineEnemy> = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object') {
      throw new TypeError('Invalid legacy enemy');
    }
    const row = value as Record<string, unknown>;
    const speciesId = safeInteger(row.id, 'enemy.id');
    const species = resources.species[String(speciesId)];
    if (!species) {
      throw new TypeError('Legacy enemy species missing');
    }
    const maximumHealth = safeInteger(row.maximumHealth, 'enemy.maximumHealth');
    enemies.push({
      ...species,
      combatId: typeof row.combatId === 'string' ? row.combatId : randomUUID(),
      health: safeInteger(row.health, 'enemy.health'),
      level: safeInteger(row.level, 'enemy.level'),
      maximumHealth,
      nextAttackAt: now,
      nextMovementAt: now,
      position: position(row.position, 'enemy.position'),
    });
  }
  return enemies;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

function runtimeMovement(value: unknown): Movement | undefined {
  if (value === undefined) {
    return undefined;
  }
  const movement = record(value, 'enemy movement');
  const direction = stringValue(movement.direction, 'movement direction');
  const validDirections = new Set([
    'down',
    'down-left',
    'down-right',
    'left',
    'right',
    'up',
    'up-left',
    'up-right',
  ]);
  if (!validDirections.has(direction) || movement.mode !== 'walking') {
    throw new TypeError('Invalid enemy movement');
  }
  return {
    direction: direction as Movement['direction'],
    durationTicks: safeInteger(movement.durationTicks, 'movement duration'),
    fromTile: position(movement.fromTile, 'movement origin'),
    mode: 'walking',
    movementId: stringValue(movement.movementId, 'movement ID'),
    startTick: safeInteger(movement.startTick, 'movement start tick'),
    startTime: safeInteger(movement.startTime, 'movement start time'),
    toTile: position(movement.toTile, 'movement destination'),
  };
}

function runtimeEnemies(value: unknown, resources: HuntResources): Array<HuntEngineEnemy> {
  if (!Array.isArray(value)) {
    throw new TypeError('Invalid runtime enemies');
  }
  const enemies: Array<HuntEngineEnemy> = [];
  for (const item of value) {
    const enemy = record(item, 'runtime enemy');
    const speciesId = safeInteger(enemy.id, 'enemy species ID');
    const species = resources.species[String(speciesId)];
    if (!species) {
      throw new TypeError('Runtime enemy species missing');
    }
    enemies.push({
      ...species,
      combatId: stringValue(enemy.combatId, 'enemy combat ID'),
      health: safeInteger(enemy.health, 'enemy health'),
      level: safeInteger(enemy.level, 'enemy level'),
      maximumHealth: safeInteger(enemy.maximumHealth, 'enemy maximum health'),
      movement: runtimeMovement(enemy.movement),
      nextAttackAt: safeInteger(enemy.nextAttackAt, 'enemy attack deadline'),
      nextMovementAt:
        enemy.nextMovementAt === undefined
          ? undefined
          : safeInteger(enemy.nextMovementAt, 'enemy movement deadline'),
      position: position(enemy.position, 'enemy position'),
    });
  }
  return enemies;
}

function runtimeCooldowns(value: unknown): Record<string, Record<string, number>> {
  if (value === undefined) {
    return {};
  }
  const actors = record(value, 'ability cooldowns');
  const result: Record<string, Record<string, number>> = {};
  for (const [actorId, cooldownValue] of Object.entries(actors)) {
    const cooldowns = record(cooldownValue, 'actor cooldowns');
    const parsed: Record<string, number> = {};
    for (const [abilityId, deadline] of Object.entries(cooldowns)) {
      parsed[abilityId] = safeInteger(deadline, 'ability cooldown deadline');
    }
    result[actorId] = parsed;
  }
  return result;
}

function runtimeCheckpoint(
  value: unknown,
  row: HuntDatabaseRow,
  resources: HuntResources,
): RuntimeSnapshotInput | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const snapshot = record(value, 'runtime snapshot');
  if (snapshot.version !== 1 || snapshot.huntId !== row.hunt_id) {
    throw new TypeError('Invalid runtime snapshot identity');
  }
  return {
    abilityCooldowns: runtimeCooldowns(snapshot.abilityCooldowns),
    activeCreatureHealth: safeInteger(snapshot.activeCreatureHealth, 'active creature health'),
    activeCreatureId: stringValue(snapshot.activeCreatureId, 'active creature ID'),
    capturedAt: safeInteger(snapshot.capturedAt, 'snapshot capture'),
    enemies: runtimeEnemies(snapshot.enemies, resources),
    enemyActionNotBefore: safeInteger(snapshot.enemyActionNotBefore, 'enemy action deadline'),
    huntId: row.hunt_id,
    nextEventAt: safeInteger(snapshot.nextEventAt, 'next event'),
    playerPosition: position(snapshot.playerPosition, 'player position'),
    revision: safeInteger(snapshot.revision, 'engine revision'),
    runtimeGeneration: stringValue(snapshot.runtimeGeneration, 'runtime generation'),
    version: 1,
    wave: safeInteger(snapshot.wave, 'wave'),
    waveDelayMs: safeInteger(snapshot.waveDelayMs, 'wave delay'),
    waveSize: safeInteger(snapshot.waveSize, 'wave size'),
    xpPending: {},
  };
}

function checkpointFromRow(
  row: HuntDatabaseRow,
  resources: HuntResources,
  now: number,
): HuntEngineCheckpoint {
  const snapshot = runtimeCheckpoint(row.runtime_snapshot, row, resources);
  if (snapshot) {
    return snapshot;
  }
  return {
    abilityCooldowns: {},
    activeCreatureHealth: safeInteger(row.active_creature_health, 'active creature health'),
    activeCreatureId: row.active_creature_id,
    capturedAt: now,
    enemies: legacyEnemies(row.enemies, resources, now),
    enemyActionNotBefore: now,
    huntId: row.hunt_id,
    nextEventAt: now,
    playerPosition: position(row.player_position, 'player position'),
    revision: safeInteger(row.revision, 'revision'),
    wave: safeInteger(row.wave, 'wave'),
    waveDelayMs: safeInteger(row.wave_delay_seconds, 'wave delay') * 1_000,
    waveSize: safeInteger(row.wave_size, 'wave size'),
    xpPending: {},
  };
}

async function rowForCharacter(characterId: string): Promise<HuntDatabaseRow | undefined> {
  const { data, error } = await serverClient
    .from('character_hunts')
    .select('*')
    .eq('character_id', characterId)
    .maybeSingle<HuntDatabaseRow>();
  if (error) {
    throw error;
  }
  return data ?? undefined;
}

async function recoverRuntime(characterId: string): Promise<Runtime | undefined> {
  const existing = runtimesByCharacter.get(characterId);
  if (existing) {
    return existing;
  }
  const row = await rowForCharacter(characterId);
  if (!row) {
    return undefined;
  }
  const resources = await loadHuntResources(serverClient, characterId, row.hunting_location_id);
  const now = epochNow();
  const recoveredDuringLoad =
    runtimesByCharacter.get(characterId) ?? runtimesByHunt.get(row.hunt_id);
  if (recoveredDuringLoad) {
    return recoveredDuringLoad;
  }
  const accountRuntime = runtimesByAccount.get(row.user_id);
  if (accountRuntime) {
    throw new Error('duplicate_account_hunt_runtime');
  }
  const checkpoint = checkpointFromRow(row, resources, now);
  const engine = createEngine(checkpoint, resources, now);
  const runtime: Runtime = {
    accountId: row.user_id,
    characterId,
    engine,
    lastConfirmedCapture: now,
    lastValidActiveCreatureId: checkpoint.activeCreatureId,
    notifyOnFinish: false,
    remoteRevision: row.revision,
    status: 'running',
  };
  installRuntime(runtime);
  ensureSimulation();
  return runtime;
}

async function runtimeAfterStart(
  startFlight: Promise<HuntState>,
  characterId: string,
): Promise<Runtime | undefined> {
  await startFlight;
  return runtimesByCharacter.get(characterId);
}

function runtimeForCharacter(characterId: string): Promise<Runtime | undefined> {
  const existing = runtimesByCharacter.get(characterId);
  if (existing) {
    return Promise.resolve(existing);
  }
  const startFlight = startFlightsByCharacter.get(characterId);
  if (startFlight) {
    return runtimeAfterStart(startFlight, characterId);
  }
  const flight = recoveryFlights.get(characterId);
  if (flight) {
    return flight;
  }
  const created = recoverRuntime(characterId);
  recoveryFlights.set(characterId, created);
  function clearFlight(): void {
    recoveryFlights.delete(characterId);
  }
  created.then(clearFlight, clearFlight);
  return created;
}

export function setHuntNotifier(value: Notify): void {
  notifier = value;
}

export async function findHunt(characterId: string): Promise<HuntState | undefined> {
  const runtime = await runtimeForCharacter(characterId);
  return runtime ? publicState(runtime, []) : undefined;
}

export async function findAccountHunt(userId: string): Promise<AccountHunt | undefined> {
  const runtime = runtimesByAccount.get(userId);
  if (runtime) {
    return { character_id: runtime.characterId };
  }
  const { data, error } = await serverClient
    .from('character_hunts')
    .select('character_id')
    .eq('user_id', userId)
    .maybeSingle<AccountHunt>();
  if (error) {
    throw error;
  }
  return data ?? undefined;
}

async function randomLocation(): Promise<{ id: number; wave_delay_seconds: number }> {
  const { data, error } = await serverClient
    .from('hunting_locations')
    .select('id, wave_delay_seconds');
  if (error || !data || data.length === 0) {
    throw error ?? new Error('no_hunting_locations');
  }
  return data[Math.floor(Math.random() * data.length)];
}

async function startHuntExclusive(characterId: string, userId: string): Promise<HuntState> {
  if (!acceptingHunts) {
    throw new Error(shutdownRequested ? 'hunt_simulation_stopping' : 'hunt_bootstrap_pending');
  }
  const current = await runtimeForCharacter(characterId);
  if (current) {
    return publicState(current, []);
  }
  const accountRuntime = runtimesByAccount.get(userId);
  if (accountRuntime) {
    throw new Error('another_character_is_hunting');
  }
  const location = await randomLocation();
  const resources = await loadHuntResources(serverClient, characterId, location.id);
  const recoveredDuringLoad = runtimesByCharacter.get(characterId);
  if (recoveredDuringLoad) {
    return publicState(recoveredDuringLoad, []);
  }
  if (runtimesByAccount.has(userId)) {
    throw new Error('another_character_is_hunting');
  }
  const active = resources.creatures[0];
  const species = resources.species[String(active.speciesId)];
  if (!species || resources.encounters.length === 0) {
    throw new Error('invalid_hunt_resources');
  }
  const now = epochNow();
  const huntId = randomUUID();
  const waveSize = 1 + Math.floor(Math.random() * 5);
  const checkpoint: HuntEngineCheckpoint = {
    activeCreatureHealth: species.baseHealth + 15,
    activeCreatureId: active.id,
    capturedAt: now,
    enemies: [],
    huntId,
    nextEventAt: now + location.wave_delay_seconds * 1_000,
    playerPosition: PLAYER_POSITION,
    revision: 1,
    wave: 1,
    waveDelayMs: location.wave_delay_seconds * 1_000,
    waveSize,
    xpPending: {},
  };
  const engine = createEngine(checkpoint, resources, now);
  const durableSnapshot = snapshotEngine(engine, now);
  const insert = {
    active_creature_health: durableSnapshot.activeCreatureHealth,
    active_creature_id: durableSnapshot.activeCreatureId,
    character_id: characterId,
    enemies: durableSnapshot.enemies,
    hunting_location_id: location.id,
    hunt_id: huntId,
    next_event_at: new Date(durableSnapshot.nextEventAt).toISOString(),
    player_position: durableSnapshot.playerPosition,
    runtime_snapshot: durableSnapshot,
    user_id: userId,
    wave_delay_seconds: location.wave_delay_seconds,
    wave_size: waveSize,
  };
  const { data, error } = await serverClient
    .from('character_hunts')
    .insert(insert)
    .select('*')
    .single<HuntDatabaseRow>();
  if (error) {
    const raced = await runtimeForCharacter(characterId);
    if (raced) {
      return publicState(raced, []);
    }
    throw error;
  }
  const installedDuringInsert =
    runtimesByCharacter.get(characterId) ?? runtimesByHunt.get(data.hunt_id);
  if (installedDuringInsert) {
    return publicState(installedDuringInsert, []);
  }
  const accountInstalledDuringInsert = runtimesByAccount.get(userId);
  if (accountInstalledDuringInsert) {
    throw new Error('another_character_is_hunting');
  }
  const runtime: Runtime = {
    accountId: userId,
    characterId,
    engine,
    lastConfirmedCapture: now,
    lastValidActiveCreatureId: active.id,
    notifyOnFinish: false,
    remoteRevision: data.revision,
    status: 'running',
  };
  installRuntime(runtime);
  ensureSimulation();
  return publicState(runtime, []);
}

async function waitForAccountStart(
  flight: Promise<HuntState>,
  characterId: string,
): Promise<HuntState> {
  const state = await flight;
  const runtime = runtimesByCharacter.get(characterId);
  if (!runtime || state.huntId !== runtime.engine.huntId) {
    throw new Error('another_character_is_hunting');
  }
  return state;
}

export function startHunt(characterId: string, userId: string): Promise<HuntState> {
  const characterFlight = startFlightsByCharacter.get(characterId);
  if (characterFlight) {
    return characterFlight;
  }
  const accountFlight = startFlightsByAccount.get(userId);
  if (accountFlight) {
    return waitForAccountStart(accountFlight, characterId);
  }
  const flight = startHuntExclusive(characterId, userId);
  startFlightsByCharacter.set(characterId, flight);
  startFlightsByAccount.set(userId, flight);
  function clearFlight(): void {
    if (startFlightsByCharacter.get(characterId) === flight) {
      startFlightsByCharacter.delete(characterId);
    }
    if (startFlightsByAccount.get(userId) === flight) {
      startFlightsByAccount.delete(userId);
    }
  }
  flight.then(clearFlight, clearFlight);
  return flight;
}

function finalizationPromise(runtime: Runtime): Promise<boolean> {
  if (runtime.finalizePromise) {
    return runtime.finalizePromise;
  }
  const executor = function executor(resolve: (finished: boolean) => void): void {
    runtime.finalizeResolve = resolve;
  };
  runtime.finalizePromise = new Promise<boolean>(executor);
  return runtime.finalizePromise;
}

async function awaitPendingCheckpoint(runtime: Runtime): Promise<void> {
  while (runtime.checkpoint && runtime.status !== 'conflict') {
    await delay(50);
  }
}

export function leaveHunt(state: HuntState): Promise<boolean> {
  const runtime = runtimesByHunt.get(state.huntId);
  if (!runtime) {
    return false;
  }
  const completion = finalizationPromise(runtime);
  runtime.notifyOnFinish = false;
  runtime.status = 'finishing';
  async function continueFinalization(): Promise<void> {
    await awaitPendingCheckpoint(runtime);
    if (runtime.status !== 'conflict') {
      launchCheckpoint(runtime, true);
    }
  }
  continueFinalization().catch(function finalizationFailed(error: unknown): void {
    logCheckpointFailure(runtime, error);
  });
  const finishWaiters: Array<Promise<boolean>> = [completion, finishTimeout()];
  return Promise.race(finishWaiters);
}

async function stopRuntime(runtime: Runtime, deadline: number): Promise<boolean> {
  if (runtime.status === 'conflict') {
    return false;
  }
  if (runtime.status === 'running') {
    pauseEngine(runtime.engine, epochNow());
    runtime.status = 'paused';
  }
  while (runtime.checkpoint && epochNow() < deadline) {
    const pending = runtime.checkpoint;
    if (pending.retryAt > 0 && pending.retryAt <= epochNow()) {
      pending.retryAt = Number.POSITIVE_INFINITY;
      performCheckpoint(runtime, pending).catch(function unexpected(error: unknown): void {
        logCheckpointFailure(runtime, error);
      });
    }
    await delay(50);
  }
  if (!runtimesByHunt.has(runtime.engine.huntId)) {
    return true;
  }
  if (runtime.checkpoint || runtime.status === 'conflict') {
    return false;
  }
  launchCheckpoint(runtime, false);
  while (runtime.checkpoint && epochNow() < deadline) {
    const pending = runtime.checkpoint;
    if (pending.retryAt > 0 && pending.retryAt <= epochNow()) {
      pending.retryAt = Number.POSITIVE_INFINITY;
      performCheckpoint(runtime, pending).catch(function unexpected(error: unknown): void {
        logCheckpointFailure(runtime, error);
      });
    }
    await delay(50);
  }
  return !runtime.checkpoint && runtime.status !== 'conflict';
}

export async function stopHuntSimulation(): Promise<void> {
  if (stopComplete) {
    return;
  }
  acceptingHunts = false;
  shutdownRequested = true;
  if (bootstrapTimer) {
    globalThis.clearTimeout(bootstrapTimer);
    bootstrapTimer = undefined;
  }
  if (tickTimer) {
    globalThis.clearInterval(tickTimer);
    tickTimer = undefined;
  }
  const deadline = epochNow() + STOP_TIMEOUT_MS;
  const tasks = [...runtimesByCharacter.values()].map(function stop(
    runtime: Runtime,
  ): Promise<boolean> {
    return stopRuntime(runtime, deadline);
  });
  const results = await Promise.all(tasks);
  if (
    results.some(function failed(result: boolean): boolean {
      return !result;
    })
  ) {
    throw new Error('hunt_simulation_checkpoint_flush_failed');
  }
  stopComplete = true;
}

ensureSimulation();
scheduleBootstrap();
logger.info('in-memory hunt simulation initialized');
