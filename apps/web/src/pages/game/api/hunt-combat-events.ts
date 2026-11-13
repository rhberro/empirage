import type { Tile } from './game-protocol';

export type HuntDamage = { amount: number; tile: Tile };
export type HuntCombatEvent = {
  abilityName: string;
  damages: Array<HuntDamage>;
  element: string;
  from: Tile;
  id: string;
  kind: 'melee' | 'ranged' | 'area';
  occurredAt: number;
  to: Tile;
  tiles: Array<Tile>;
};

type CombatEvents = Array<HuntCombatEvent>;
type HuntDamages = Array<HuntDamage>;
type Tiles = Array<Tile>;
type UnknownRecord = Record<string, unknown>;

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

function readDamages(value: unknown): HuntDamages {
  const damages: HuntDamages = [];
  if (!Array.isArray(value)) {
    return damages;
  }
  for (const damageValue of value) {
    if (!isRecord(damageValue) || !isCount(damageValue.amount)) {
      continue;
    }
    const tile = readTile(damageValue.tile);
    if (tile) {
      const damage = { amount: damageValue.amount, tile };
      damages.push(damage);
    }
  }
  return damages;
}

export function readCombatEvents(value: unknown): CombatEvents {
  const events: CombatEvents = [];
  if (!Array.isArray(value)) {
    return events;
  }
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.abilityName !== 'string' ||
      item.abilityName.length === 0 ||
      (item.kind !== 'melee' && item.kind !== 'ranged' && item.kind !== 'area')
    ) {
      continue;
    }
    const from = readTile(item.from);
    const to = readTile(item.to);
    if (!from || !to) {
      continue;
    }
    const tiles: Tiles = [];
    if (Array.isArray(item.tiles)) {
      for (const tileValue of item.tiles) {
        const tile = readTile(tileValue);
        if (tile) {
          tiles.push(tile);
        }
      }
    }
    const occurredAt =
      typeof item.occurredAt === 'number' && Number.isFinite(item.occurredAt) ? item.occurredAt : 0;
    const event: HuntCombatEvent = {
      abilityName: item.abilityName,
      damages: readDamages(item.damages),
      element: typeof item.element === 'string' ? item.element : 'normal',
      from,
      id: item.id,
      kind: item.kind,
      occurredAt,
      tiles,
      to,
    };
    events.push(event);
  }
  return events;
}
