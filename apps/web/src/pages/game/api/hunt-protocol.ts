/* eslint-disable max-lines, complexity, max-lines-per-function, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
import type { ProtocolDirection, Tile } from './game-protocol';
import { readCombatEvents } from './hunt-combat-events';
import type { HuntCombatEvent } from './hunt-combat-events';

export type { HuntCombatEvent } from './hunt-combat-events';

type CombatEvents = Array<HuntCombatEvent>;
type HealingItems = Array<HealingItem>;
type HuntAvailableAbilities = Array<HuntAvailableAbility>;

export type HuntMovement = {
  direction: ProtocolDirection;
  durationTicks: number;
  fromTile: Tile;
  startTime: number;
  toTile: Tile;
};
export type HuntEnemy = {
  combatId?: string;
  id: number;
  name: string;
  health: number;
  maximumHealth: number;
  level: number;
  position: Tile;
  movement: HuntMovement | null;
};
export type HuntAbility = {
  accuracy: number | null;
  areaRadius: number;
  category: 'physical' | 'special' | 'status';
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
export type HuntAvailableAbility = Omit<HuntAbility, 'cooldownEndsAt' | 'slot'>;
export type HealingItem = {
  goldCost: number;
  healingAmount: number;
  id: number;
  name: string;
  restoresFullHealth: boolean;
  slug: string;
};
export type HealingConfiguration = { itemId: number; thresholdPercentage: number };
export type CaptureRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type CaptureItem = {
  captureRateMultiplier: number;
  goldCost: number;
  id: number;
  name: string;
  slug: string;
};
export type CaptureConfiguration = { itemId: number; rarities: Array<CaptureRarity> };
export type CaptureAttempt = {
  completesAt: number;
  id: string;
  position: Tile;
  settledAt: number | undefined;
  status: 'pending' | 'failed' | 'succeeded';
  succeeded: boolean;
};
export type HuntWaveRange = { maximumSize: number; minimumSize: number };
export type PartyCreatureHealth = {
  creatureId: string;
  health: number;
  maximumHealth: number;
};
type HuntAbilities = Array<HuntAbility>;
type HuntStatus = Pick<
  HuntState,
  | 'activeCreatureElements'
  | 'activeCreatureExperience'
  | 'activeCreatureExperienceLevelStart'
  | 'activeCreatureExperienceNextLevel'
  | 'activeCreatureName'
  | 'characterAvatarUrl'
  | 'characterLevel'
  | 'characterName'
>;
type HuntRuntimeState = Pick<HuntState, 'runtimeGeneration' | 'serverTime'>;
export type HuntGrid = { blocked: Tiles; height: number; tileSize: number; width: number };
export type HuntState = {
  activeCreatureAvailableAt: number;
  activeCreatureElements: Array<string>;
  activeCreatureExperience: string;
  activeCreatureExperienceLevelStart: string;
  activeCreatureExperienceNextLevel: string;
  activeCreatureAbilities: HuntAbilities;
  activeCreatureAvailableAbilities: Array<HuntAvailableAbility>;
  activeCreatureHealth: number;
  activeCreatureId: string;
  activeCreatureLevel: number;
  activeCreatureMaximumHealth: number;
  activeCreatureName: string;
  activeCreatureSpeciesId: number | null;
  activeCreatureSwitchCompletesAt: number | undefined;
  activeCreatureSwitchCooldownEndsAt: number;
  allyPosition: Tile;
  partyHealth: Array<PartyCreatureHealth>;
  combatEvents: CombatEvents;
  characterAvatarUrl: string | null;
  characterLevel: number;
  characterName: string;
  captureAttempts: Array<CaptureAttempt>;
  captureConfiguration: CaptureConfiguration | undefined;
  captureItems: Array<CaptureItem>;
  enemies: Array<HuntEnemy>;
  gold: number;
  grid: HuntGrid;
  healingConfiguration: HealingConfiguration | undefined;
  healingItemCooldownEndsAt: number;
  healingItems: HealingItems;
  huntingLocationId: number;
  huntId: string;
  nextEventAt: string;
  playerPosition: Tile;
  revision: number;
  runtimeGeneration?: string;
  serverTime?: number;
  wave: number;
  waveRange: HuntWaveRange;
};
export type BattleConfiguration = Pick<
  HuntState,
  | 'activeCreatureAbilities'
  | 'activeCreatureAvailableAbilities'
  | 'activeCreatureLevel'
  | 'captureConfiguration'
  | 'captureItems'
  | 'healingConfiguration'
  | 'healingItemCooldownEndsAt'
  | 'healingItems'
>;
export type PartyCreatureConfiguration = Pick<
  BattleConfiguration,
  'activeCreatureAbilities' | 'activeCreatureAvailableAbilities' | 'activeCreatureLevel'
>;
export type PartyCreatureConfigurations = Record<string, PartyCreatureConfiguration>;
export type HuntStateEvent = { hunt: HuntState | null; huntId?: string; type: 'hunt_state' };
export type HuntDeltaEvent = {
  huntId: string;
  patch: Record<string, unknown>;
  previousRevision: number;
  revision: number;
  type: 'hunt_delta';
};
type CommandIdentity = { commandId?: string };
type HuntCommandPayload =
  | { huntingLocationId: number; type: 'start_hunt'; version: 1 }
  | { type: 'leave_hunt'; version: 1 }
  | {
      healingItemId: number;
      healingThresholdPercentage: number;
      type: 'configure_healing_item';
      version: 1;
    }
  | {
      captureItemId: number;
      captureRarities: Array<CaptureRarity>;
      type: 'configure_capture';
      version: 1;
    }
  | {
      creatureId: string;
      type: 'move_creature_to_party' | 'move_creature_to_storage' | 'switch_active_creature';
      version: 1;
    }
  | { creatureId: string; type: 'release_creature'; version: 1 }
  | {
      creatureId: string;
      targetPartySlot: number;
      type: 'reorder_party_creature';
      version: 1;
    }
  | { storagePage: number; type: 'request_creature_storage'; version: 1 }
  | { type: 'request_hunt_state'; version: 1 }
  | { abilityId: number | null; abilitySlot: number; type: 'configure_ability'; version: 1 }
  | {
      type: 'configure_wave_range';
      version: 1;
      waveRangeMaximumSize: number;
      waveRangeMinimumSize: number;
    };
export type HuntCommand = CommandIdentity & HuntCommandPayload;
type UnknownRecord = Record<string, unknown>;
type Tiles = Array<Tile>;
type HuntEnemies = Array<HuntEnemy>;

const MAXIMUM_GRID_DIMENSION = 64;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function reconcileHuntMovement(
  current: HuntMovement | null,
  incoming: HuntMovement | null,
  position: Tile,
): HuntMovement | null {
  if (!incoming && current && current.toTile.x === position.x && current.toTile.y === position.y) {
    return current;
  }
  return incoming;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isWaveRange(value: unknown): value is HuntWaveRange {
  if (!isRecord(value) || !isCount(value.minimumSize) || !isCount(value.maximumSize)) {
    return false;
  }
  return value.minimumSize > 0 && value.maximumSize >= value.minimumSize;
}

function readWaveRange(value: unknown): HuntWaveRange {
  if (!isWaveRange(value)) {
    throw new TypeError('invalid_wave_range');
  }
  return { maximumSize: value.maximumSize, minimumSize: value.minimumSize };
}

function isExperience(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/u.test(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function readTile(value: unknown): Tile | null {
  if (!isRecord(value) || !isCount(value.x) || !isCount(value.y)) {
    return null;
  }
  return { x: value.x, y: value.y };
}

function readProtocolDirection(value: unknown): ProtocolDirection | null {
  if (value === 'down' || value === 'left' || value === 'right' || value === 'up') {
    return value;
  }
  return null;
}

function readMovement(value: unknown): HuntMovement | null {
  if (
    !isRecord(value) ||
    typeof value.startTime !== 'number' ||
    !Number.isFinite(value.startTime) ||
    !isCount(value.durationTicks) ||
    value.durationTicks === 0
  ) {
    return null;
  }
  const direction = readProtocolDirection(value.direction);
  const fromTile = readTile(value.fromTile);
  const toTile = readTile(value.toTile);
  if (!direction || !fromTile || !toTile) {
    return null;
  }
  return {
    direction,
    durationTicks: value.durationTicks,
    fromTile,
    startTime: value.startTime,
    toTile,
  };
}

function readEnemy(value: unknown): HuntEnemy | null {
  if (
    !isRecord(value) ||
    !isCount(value.id) ||
    typeof value.name !== 'string' ||
    !isCount(value.health) ||
    !isCount(value.maximumHealth) ||
    !isCount(value.level) ||
    (value.combatId !== undefined &&
      (typeof value.combatId !== 'string' || value.combatId.length === 0))
  ) {
    return null;
  }
  const position = readTile(value.position);
  if (!position) {
    return null;
  }
  return {
    ...(typeof value.combatId === 'string' && value.combatId.length > 0
      ? { combatId: value.combatId }
      : {}),
    health: value.health,
    id: value.id,
    level: value.level,
    maximumHealth: value.maximumHealth,
    movement: isRecord(value.movement) ? readMovement(value.movement) : null,
    name: value.name,
    position,
  };
}

function readGrid(value: unknown): HuntGrid | null {
  if (
    !isRecord(value) ||
    !isCount(value.height) ||
    !isCount(value.tileSize) ||
    !isCount(value.width) ||
    value.height === 0 ||
    value.width === 0 ||
    value.tileSize === 0 ||
    value.height > MAXIMUM_GRID_DIMENSION ||
    value.width > MAXIMUM_GRID_DIMENSION ||
    !Array.isArray(value.blocked)
  ) {
    return null;
  }
  const blocked: Tiles = [];
  for (const item of value.blocked) {
    const tile = readTile(item);
    if (!tile) {
      return null;
    }
    blocked.push(tile);
  }
  return {
    blocked,
    height: value.height,
    tileSize: value.tileSize,
    width: value.width,
  };
}

function readEnemies(items: Array<unknown>): HuntEnemies | null {
  const enemies: HuntEnemies = [];
  for (const item of items) {
    const enemy = readEnemy(item);
    if (!enemy) {
      return null;
    }
    enemies.push(enemy);
  }
  return enemies;
}

function readSpeciesId(value: unknown): number | null {
  return isCount(value) && value > 0 ? value : null;
}

function readAbility(value: unknown): HuntAbility | null {
  if (
    !isRecord(value) ||
    !isCount(value.cooldownEndsAt) ||
    !isCount(value.cooldownMs) ||
    value.cooldownMs === 0 ||
    typeof value.element !== 'string' ||
    typeof value.id !== 'number' ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    typeof value.name !== 'string' ||
    !isCount(value.slot) ||
    value.slot < 1 ||
    value.slot > 4
  ) {
    return null;
  }
  return {
    accuracy: readNullableCount(value.accuracy),
    areaRadius: isCount(value.areaRadius) ? value.areaRadius : 0,
    category: readAbilityCategory(value.category),
    cooldownEndsAt: value.cooldownEndsAt,
    cooldownMs: value.cooldownMs,
    element: value.element,
    id: value.id,
    name: value.name,
    power: readNullableCount(value.power),
    range: isCount(value.range) ? value.range : 0,
    requiredLevel: isCount(value.requiredLevel) ? value.requiredLevel : 1,
    slot: value.slot,
  };
}

function readNullableCount(value: unknown): number | null {
  return value === null ? null : isCount(value) ? value : null;
}

function readAbilityCategory(value: unknown): HuntAbility['category'] {
  return value === 'physical' || value === 'special' || value === 'status' ? value : 'status';
}

function readAvailableAbility(value: unknown): HuntAvailableAbility | null {
  if (!isRecord(value)) {
    return null;
  }
  const abilityInput = { ...value, cooldownEndsAt: 0, slot: 1 };
  const ability = readAbility(abilityInput);
  if (!ability) {
    return null;
  }
  const { cooldownEndsAt: _cooldownEndsAt, slot: _slot, ...available } = ability;
  return available;
}

function readAvailableAbilities(value: unknown): HuntAvailableAbilities | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const abilities: HuntAvailableAbilities = [];
  for (const item of value) {
    const ability = readAvailableAbility(item);
    if (!ability) {
      return null;
    }
    abilities.push(ability);
  }
  return abilities;
}

function readAbilities(value: unknown): HuntAbilities | null {
  if (!Array.isArray(value) || value.length > 4) {
    return null;
  }
  const abilities: HuntAbilities = [];
  const slots = new Set<number>();
  for (const item of value) {
    const ability = readAbility(item);
    if (!ability || slots.has(ability.slot)) {
      return null;
    }
    slots.add(ability.slot);
    abilities.push(ability);
  }
  return abilities;
}

export function readPartyCreatureConfiguration(value: unknown): PartyCreatureConfiguration | null {
  if (!isRecord(value) || !isCount(value.activeCreatureLevel)) {
    return null;
  }
  const activeCreatureAbilities = readAbilities(value.activeCreatureAbilities);
  const activeCreatureAvailableAbilities = readAvailableAbilities(
    value.activeCreatureAvailableAbilities,
  );
  if (!activeCreatureAbilities || !activeCreatureAvailableAbilities) {
    return null;
  }
  return {
    activeCreatureAbilities,
    activeCreatureAvailableAbilities,
    activeCreatureLevel: value.activeCreatureLevel,
  };
}

function readHealingItem(value: unknown): HealingItem | null {
  if (
    !isRecord(value) ||
    !isCount(value.goldCost) ||
    value.goldCost === 0 ||
    !isCount(value.healingAmount) ||
    !isCount(value.id) ||
    value.id === 0 ||
    typeof value.name !== 'string' ||
    typeof value.restoresFullHealth !== 'boolean' ||
    typeof value.slug !== 'string' ||
    (!value.restoresFullHealth && value.healingAmount === 0)
  ) {
    return null;
  }
  return {
    goldCost: value.goldCost,
    healingAmount: value.healingAmount,
    id: value.id,
    name: value.name,
    restoresFullHealth: value.restoresFullHealth,
    slug: value.slug,
  };
}

function readHealingItems(value: unknown): HealingItems | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: HealingItems = [];
  for (const valueItem of value) {
    const item = readHealingItem(valueItem);
    if (!item) {
      return null;
    }
    items.push(item);
  }
  return items;
}

function readHealingConfiguration(value: unknown): HealingConfiguration | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (
    !isRecord(value) ||
    !isCount(value.itemId) ||
    value.itemId === 0 ||
    !isCount(value.thresholdPercentage) ||
    value.thresholdPercentage < 1 ||
    value.thresholdPercentage > 100
  ) {
    return null;
  }
  return { itemId: value.itemId, thresholdPercentage: value.thresholdPercentage };
}

function hasHealingState(value: UnknownRecord): boolean {
  return (
    isCount(value.gold) &&
    isCount(value.healingItemCooldownEndsAt) &&
    Array.isArray(value.healingItems)
  );
}

function readCaptureRarity(value: unknown): CaptureRarity | null {
  return value === 'common' ||
    value === 'uncommon' ||
    value === 'rare' ||
    value === 'epic' ||
    value === 'legendary'
    ? value
    : null;
}

function readCaptureState(
  value: UnknownRecord,
): Pick<HuntState, 'captureAttempts' | 'captureConfiguration' | 'captureItems'> | null {
  if (!Array.isArray(value.captureAttempts) || !Array.isArray(value.captureItems)) {
    return null;
  }
  const captureItems: Array<CaptureItem> = [];
  for (const item of value.captureItems) {
    if (
      !isRecord(item) ||
      !isCount(item.captureRateMultiplier) ||
      !isCount(item.goldCost) ||
      !isCount(item.id) ||
      !isString(item.name) ||
      !isString(item.slug)
    ) {
      return null;
    }
    captureItems.push({
      captureRateMultiplier: item.captureRateMultiplier,
      goldCost: item.goldCost,
      id: item.id,
      name: item.name,
      slug: item.slug,
    });
  }
  const captureAttempts: Array<CaptureAttempt> = [];
  for (const attempt of value.captureAttempts) {
    if (
      !isRecord(attempt) ||
      typeof attempt.completesAt !== 'number' ||
      !isString(attempt.id) ||
      (attempt.settledAt !== undefined && typeof attempt.settledAt !== 'number') ||
      (attempt.status !== 'pending' &&
        attempt.status !== 'failed' &&
        attempt.status !== 'succeeded') ||
      typeof attempt.succeeded !== 'boolean'
    ) {
      return null;
    }
    const position = readTile(attempt.position);
    if (!position) {
      return null;
    }
    captureAttempts.push({
      completesAt: attempt.completesAt,
      id: attempt.id,
      position,
      settledAt: attempt.settledAt,
      status: attempt.status,
      succeeded: attempt.succeeded,
    });
  }
  if (value.captureConfiguration === undefined) {
    return { captureAttempts, captureConfiguration: undefined, captureItems };
  }
  if (
    !isRecord(value.captureConfiguration) ||
    !isCount(value.captureConfiguration.itemId) ||
    !Array.isArray(value.captureConfiguration.rarities)
  ) {
    return null;
  }
  const rarities: Array<CaptureRarity> = [];
  for (const rarityValue of value.captureConfiguration.rarities) {
    const rarity = readCaptureRarity(rarityValue);
    if (!rarity) {
      return null;
    }
    rarities.push(rarity);
  }
  return {
    captureAttempts,
    captureConfiguration: { itemId: value.captureConfiguration.itemId, rarities },
    captureItems,
  };
}

function hasHuntIdentity(value: UnknownRecord): boolean {
  return (
    typeof value.activeCreatureId === 'string' &&
    typeof value.huntId === 'string' &&
    UUID_PATTERN.test(value.huntId) &&
    typeof value.nextEventAt === 'string' &&
    Number.isFinite(Date.parse(value.nextEventAt))
  );
}

function hasOptionalRuntimeState(value: UnknownRecord): boolean {
  return (
    (value.runtimeGeneration === undefined ||
      (typeof value.runtimeGeneration === 'string' &&
        UUID_PATTERN.test(value.runtimeGeneration))) &&
    (value.serverTime === undefined ||
      (typeof value.serverTime === 'number' && Number.isFinite(value.serverTime)))
  );
}

function hasHuntStatus(value: UnknownRecord): boolean {
  return (
    Array.isArray(value.activeCreatureElements) &&
    value.activeCreatureElements.every(isString) &&
    isExperience(value.activeCreatureExperience) &&
    isExperience(value.activeCreatureExperienceLevelStart) &&
    isExperience(value.activeCreatureExperienceNextLevel) &&
    typeof value.activeCreatureName === 'string' &&
    (value.characterAvatarUrl === null || typeof value.characterAvatarUrl === 'string') &&
    isCount(value.characterLevel) &&
    typeof value.characterName === 'string'
  );
}

function readPartyHealth(value: unknown): Array<PartyCreatureHealth> | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const partyHealth: Array<PartyCreatureHealth> = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.creatureId !== 'string' ||
      !isCount(item.health) ||
      !isCount(item.maximumHealth) ||
      item.health > item.maximumHealth
    ) {
      return null;
    }
    partyHealth.push({
      creatureId: item.creatureId,
      health: item.health,
      maximumHealth: item.maximumHealth,
    });
  }
  return partyHealth;
}

function readHuntStatus(value: UnknownRecord): HuntStatus {
  return {
    activeCreatureElements: value.activeCreatureElements as Array<string>,
    activeCreatureExperience: value.activeCreatureExperience as string,
    activeCreatureExperienceLevelStart: value.activeCreatureExperienceLevelStart as string,
    activeCreatureExperienceNextLevel: value.activeCreatureExperienceNextLevel as string,
    activeCreatureName: value.activeCreatureName as string,
    characterAvatarUrl: value.characterAvatarUrl as string | null,
    characterLevel: value.characterLevel as number,
    characterName: value.characterName as string,
  };
}

function readHuntRuntimeState(value: UnknownRecord): HuntRuntimeState {
  return {
    runtimeGeneration:
      typeof value.runtimeGeneration === 'string' ? value.runtimeGeneration : undefined,
    serverTime: typeof value.serverTime === 'number' ? value.serverTime : undefined,
  };
}

function isHuntRecord(value: unknown): value is UnknownRecord {
  return (
    isRecord(value) &&
    hasHuntStatus(value) &&
    Array.isArray(value.activeCreatureAbilities) &&
    Array.isArray(value.activeCreatureAvailableAbilities) &&
    isCount(value.activeCreatureHealth) &&
    isCount(value.activeCreatureAvailableAt) &&
    isCount(value.activeCreatureLevel) &&
    isCount(value.activeCreatureMaximumHealth) &&
    isCount(value.activeCreatureSwitchCooldownEndsAt) &&
    (value.activeCreatureSwitchCompletesAt === undefined ||
      isCount(value.activeCreatureSwitchCompletesAt)) &&
    hasHealingState(value) &&
    hasHuntIdentity(value) &&
    isCount(value.huntingLocationId) &&
    isCount(value.revision) &&
    hasOptionalRuntimeState(value) &&
    isCount(value.wave) &&
    isWaveRange(value.waveRange) &&
    Array.isArray(value.partyHealth) &&
    Array.isArray(value.enemies)
  );
}

function readHunt(value: UnknownRecord): HuntState | null {
  const grid = readGrid(value.grid);
  const allyPosition = isRecord(value.allyPosition) ? readTile(value.allyPosition) : null;
  const playerPosition = isRecord(value.playerPosition) ? readTile(value.playerPosition) : null;
  const partyHealth = readPartyHealth(value.partyHealth);
  const enemies = readEnemies(value.enemies);
  const activeCreatureAbilities = readAbilities(value.activeCreatureAbilities);
  const activeCreatureAvailableAbilities = readAvailableAbilities(
    value.activeCreatureAvailableAbilities,
  );
  const healingItems = readHealingItems(value.healingItems);
  const healingConfiguration = readHealingConfiguration(value.healingConfiguration);
  const captureState = readCaptureState(value);
  if (
    !grid ||
    !allyPosition ||
    !playerPosition ||
    !partyHealth ||
    !enemies ||
    !activeCreatureAbilities ||
    !activeCreatureAvailableAbilities ||
    !healingItems ||
    healingConfiguration === null ||
    !captureState
  ) {
    return null;
  }
  const status = readHuntStatus(value);
  return {
    ...readHuntRuntimeState(value),
    ...captureState,
    ...status,
    activeCreatureAbilities,
    activeCreatureAvailableAbilities,
    activeCreatureAvailableAt: value.activeCreatureAvailableAt as number,
    activeCreatureHealth: value.activeCreatureHealth as number,
    activeCreatureId: value.activeCreatureId as string,
    activeCreatureLevel: value.activeCreatureLevel as number,
    activeCreatureMaximumHealth: value.activeCreatureMaximumHealth as number,
    activeCreatureSpeciesId: readSpeciesId(value.activeCreatureSpeciesId),
    activeCreatureSwitchCompletesAt:
      value.activeCreatureSwitchCompletesAt === undefined
        ? undefined
        : (value.activeCreatureSwitchCompletesAt as number),
    activeCreatureSwitchCooldownEndsAt: value.activeCreatureSwitchCooldownEndsAt as number,
    allyPosition,
    combatEvents: readCombatEvents(value.combatEvents),
    enemies,
    gold: value.gold as number,
    grid,
    healingConfiguration,
    healingItemCooldownEndsAt: value.healingItemCooldownEndsAt as number,
    healingItems,
    huntId: value.huntId as string,
    huntingLocationId: value.huntingLocationId as number,
    nextEventAt: value.nextEventAt as string,
    partyHealth,
    playerPosition,
    revision: value.revision as number,
    wave: value.wave as number,
    waveRange: readWaveRange(value.waveRange),
  };
}

export function readHuntState(value: unknown, envelopeHuntId?: unknown): HuntStateEvent | null {
  if (value === null) {
    if (
      envelopeHuntId !== undefined &&
      (typeof envelopeHuntId !== 'string' || !UUID_PATTERN.test(envelopeHuntId))
    ) {
      return null;
    }
    return {
      ...(typeof envelopeHuntId === 'string' ? { huntId: envelopeHuntId } : {}),
      hunt: null,
      type: 'hunt_state',
    };
  }
  if (!isHuntRecord(value)) {
    return null;
  }
  const hunt = readHunt(value);
  if (!hunt) {
    return null;
  }
  return { hunt, huntId: hunt.huntId, type: 'hunt_state' };
}

export function readHuntDelta(value: unknown): HuntDeltaEvent | null {
  if (
    !isRecord(value) ||
    typeof value.huntId !== 'string' ||
    !UUID_PATTERN.test(value.huntId) ||
    !isCount(value.previousRevision) ||
    !isCount(value.revision) ||
    value.revision !== value.previousRevision + 1 ||
    !isRecord(value.patch)
  ) {
    return null;
  }
  return {
    huntId: value.huntId,
    patch: value.patch,
    previousRevision: value.previousRevision,
    revision: value.revision,
    type: 'hunt_delta',
  };
}
