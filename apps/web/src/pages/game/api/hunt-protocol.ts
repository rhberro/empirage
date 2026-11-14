/* eslint-disable max-lines */
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
type HuntAbilities = Array<HuntAbility>;
export type HuntGrid = { blocked: Tiles; height: number; tileSize: number; width: number };
export type HuntState = {
  activeCreatureAbilities: HuntAbilities;
  activeCreatureAvailableAbilities: Array<HuntAvailableAbility>;
  activeCreatureHealth: number;
  activeCreatureId: string;
  activeCreatureLevel: number;
  activeCreatureMaximumHealth: number;
  activeCreatureSpeciesId: number | null;
  allyPosition: Tile;
  combatEvents: CombatEvents;
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
};
export type HuntStateEvent = { hunt: HuntState | null; huntId?: string; type: 'hunt_state' };
export type HuntCommand =
  | { type: 'start_hunt' | 'leave_hunt'; version: 1 }
  | {
      healingItemId: number;
      healingThresholdPercentage: number;
      type: 'configure_healing_item';
      version: 1;
    }
  | { abilityId: number | null; abilitySlot: number; type: 'configure_ability'; version: 1 };
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

function isHuntRecord(value: unknown): value is UnknownRecord {
  return (
    isRecord(value) &&
    Array.isArray(value.activeCreatureAbilities) &&
    Array.isArray(value.activeCreatureAvailableAbilities) &&
    isCount(value.activeCreatureHealth) &&
    isCount(value.activeCreatureLevel) &&
    isCount(value.activeCreatureMaximumHealth) &&
    hasHealingState(value) &&
    hasHuntIdentity(value) &&
    isCount(value.huntingLocationId) &&
    isCount(value.revision) &&
    hasOptionalRuntimeState(value) &&
    isCount(value.wave) &&
    Array.isArray(value.enemies)
  );
}

function readHunt(value: UnknownRecord): HuntState | null {
  const grid = readGrid(value.grid);
  const allyPosition = isRecord(value.allyPosition) ? readTile(value.allyPosition) : null;
  const playerPosition = isRecord(value.playerPosition) ? readTile(value.playerPosition) : null;
  const enemies = readEnemies(value.enemies);
  const activeCreatureAbilities = readAbilities(value.activeCreatureAbilities);
  const activeCreatureAvailableAbilities = readAvailableAbilities(
    value.activeCreatureAvailableAbilities,
  );
  const healingItems = readHealingItems(value.healingItems);
  const healingConfiguration = readHealingConfiguration(value.healingConfiguration);
  if (
    !grid ||
    !allyPosition ||
    !playerPosition ||
    !enemies ||
    !activeCreatureAbilities ||
    !activeCreatureAvailableAbilities ||
    !healingItems ||
    healingConfiguration === null
  ) {
    return null;
  }
  return {
    activeCreatureAbilities,
    activeCreatureAvailableAbilities,
    activeCreatureHealth: value.activeCreatureHealth as number,
    activeCreatureId: value.activeCreatureId as string,
    activeCreatureLevel: value.activeCreatureLevel as number,
    activeCreatureMaximumHealth: value.activeCreatureMaximumHealth as number,
    activeCreatureSpeciesId: readSpeciesId(value.activeCreatureSpeciesId),
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
    playerPosition,
    revision: value.revision as number,
    runtimeGeneration:
      typeof value.runtimeGeneration === 'string' ? value.runtimeGeneration : undefined,
    serverTime: typeof value.serverTime === 'number' ? value.serverTime : undefined,
    wave: value.wave as number,
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
