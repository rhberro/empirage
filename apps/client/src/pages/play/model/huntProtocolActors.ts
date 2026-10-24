/* eslint-disable max-lines */
import type {
  HuntAbilityCooldown,
  HuntCaptureDevice,
  HuntConsumableSlot,
  HuntCreatureActor,
  HuntLedger,
  HuntLedgerItem,
  HuntSessionInfo,
  HuntTeamMemberActor,
  HuntTrainerActor,
  HuntWaveEvent,
  HuntWaveTile,
} from '@creatures/contracts/huntSim';
import type { Element } from '@creatures/contracts/species';
import type { Direction, PathSegment, Tile } from '@creatures/contracts/world';

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

const ELEMENTS: ReadonlySet<string> = new Set<Element>(['fire', 'water', 'plant', 'neutral']);

const KINDS: ReadonlySet<string> = new Set(['player', 'wild']);

const BEHAVIORS: ReadonlySet<string> = new Set(['idle', 'chasing', 'attacking']);

export function readCreatureActor(value: unknown): HuntCreatureActor | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== 'string' ||
    !isFiniteNumber(value.hp) ||
    !isFiniteNumber(value.maxHp) ||
    !isFiniteNumber(value.level) ||
    !isTile(value.tile) ||
    !isDirection(value.dir) ||
    typeof value.speciesName !== 'string' ||
    typeof value.speciesSlug !== 'string' ||
    !isKind(value.kind)
  ) {
    return null;
  }
  if (value.behavior !== undefined && !isBehavior(value.behavior)) {
    return null;
  }
  if (value.segment !== undefined && value.segment !== null && !isPathSegment(value.segment)) {
    return null;
  }
  if (
    value.targetId !== undefined &&
    value.targetId !== null &&
    typeof value.targetId !== 'string'
  ) {
    return null;
  }
  return value as HuntCreatureActor;
}

export function readActors(value: unknown): HuntCreatureActor[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const actors: HuntCreatureActor[] = [];
  for (const actor of value) {
    const read = readCreatureActor(actor);
    if (read === null) {
      return null;
    }
    actors.push(read);
  }
  return actors;
}

export function readTrainer(value: unknown): HuntTrainerActor | null {
  if (!isRecord(value) || !isTile(value.tile) || !isDirection(value.dir)) {
    return null;
  }
  if (value.segment !== undefined && value.segment !== null && !isPathSegment(value.segment)) {
    return null;
  }
  return value as HuntTrainerActor;
}

export function readSession(value: unknown): HuntSessionInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.areaName !== 'string' ||
    typeof value.areaSlug !== 'string' ||
    !isFiniteNumber(value.endsAt) ||
    typeof value.id !== 'string' ||
    !isFiniteNumber(value.startedAt) ||
    value.status !== 'active'
  ) {
    return null;
  }
  return value as HuntSessionInfo;
}

export function readLedger(value: unknown): HuntLedger | null {
  if (!isRecord(value)) {
    return null;
  }
  const drops = readLedgerItems(value.drops);
  const spent = readLedgerItems(value.spent);
  if (
    drops === null ||
    spent === null ||
    !isFiniteNumber(value.encounters) ||
    !isFiniteNumber(value.experience) ||
    !isFiniteNumber(value.kills)
  ) {
    return null;
  }
  return {
    drops,
    encounters: value.encounters,
    experience: value.experience,
    kills: value.kills,
    spent,
  };
}

export function readAbilities(value: unknown): HuntAbilityCooldown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const abilities: HuntAbilityCooldown[] = [];
  for (const ability of value) {
    if (
      !isRecord(ability) ||
      typeof ability.abilitySlug !== 'string' ||
      !isFiniteNumber(ability.cooldownMs) ||
      !isElement(ability.element) ||
      typeof ability.name !== 'string' ||
      !isFiniteNumber(ability.readyAt) ||
      !isFiniteNumber(ability.slot)
    ) {
      return null;
    }
    abilities.push({
      abilitySlug: ability.abilitySlug,
      cooldownMs: ability.cooldownMs,
      element: ability.element,
      name: ability.name,
      readyAt: ability.readyAt,
      slot: ability.slot,
    });
  }
  return abilities;
}

export function readConsumables(value: unknown): HuntConsumableSlot[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const consumables: HuntConsumableSlot[] = [];
  for (const slot of value) {
    if (
      !isRecord(slot) ||
      typeof slot.itemId !== 'string' ||
      typeof slot.name !== 'string' ||
      !isFiniteNumber(slot.quantity) ||
      !isFiniteNumber(slot.readyAt) ||
      !isFiniteNumber(slot.slot) ||
      !isFiniteNumber(slot.triggerHpPercent)
    ) {
      return null;
    }
    consumables.push({
      itemId: slot.itemId,
      name: slot.name,
      quantity: slot.quantity,
      readyAt: slot.readyAt,
      slot: slot.slot,
      triggerHpPercent: slot.triggerHpPercent,
    });
  }
  return consumables;
}

/**
 * The capture device of the trainer, or null when the message is malformed.
 *
 * A null device is a valid state of the hunt (nothing equipped), so the reader
 * only rejects the object that does not carry the fields of a device.
 */
export function readCaptureDevice(value: unknown): HuntCaptureDevice | null {
  if (
    !isRecord(value) ||
    typeof value.itemId !== 'string' ||
    !isFiniteNumber(value.multiplier) ||
    typeof value.name !== 'string' ||
    !isFiniteNumber(value.quantity) ||
    !isFiniteNumber(value.slot)
  ) {
    return null;
  }
  return {
    itemId: value.itemId,
    multiplier: value.multiplier,
    name: value.name,
    quantity: value.quantity,
    slot: value.slot,
  };
}

export function readTeam(value: unknown): HuntTeamMemberActor[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const team: HuntTeamMemberActor[] = [];
  for (const member of value) {
    if (
      !isRecord(member) ||
      typeof member.fainted !== 'boolean' ||
      typeof member.id !== 'string' ||
      !isFiniteNumber(member.level) ||
      typeof member.speciesName !== 'string' ||
      typeof member.speciesSlug !== 'string' ||
      !isFiniteNumber(member.teamSlot)
    ) {
      return null;
    }
    team.push({
      fainted: member.fainted,
      id: member.id,
      level: member.level,
      speciesName: member.speciesName,
      speciesSlug: member.speciesSlug,
      teamSlot: member.teamSlot,
    });
  }
  return team;
}

export function readWaves(value: unknown): HuntWaveEvent[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const waves: HuntWaveEvent[] = [];
  for (const wave of value) {
    const read = readWave(wave);
    if (read === null) {
      return null;
    }
    waves.push(read);
  }
  return waves;
}

export function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const strings: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      return null;
    }
    strings.push(entry);
  }
  return strings;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isTile(value: unknown): value is Tile {
  if (!isRecord(value)) {
    return false;
  }
  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

export function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && DIRECTIONS.has(value);
}

export function isElement(value: unknown): value is Element {
  return typeof value === 'string' && ELEMENTS.has(value);
}

function isKind(value: unknown): value is HuntCreatureActor['kind'] {
  return typeof value === 'string' && KINDS.has(value);
}

function isBehavior(value: unknown): value is NonNullable<HuntCreatureActor['behavior']> {
  return typeof value === 'string' && BEHAVIORS.has(value);
}

function isPathSegment(value: unknown): value is PathSegment {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isTile(value.from) &&
    isTile(value.to) &&
    isDirection(value.dir) &&
    isFiniteNumber(value.startsAt) &&
    isFiniteNumber(value.endsAt)
  );
}

function readLedgerItems(value: unknown): HuntLedgerItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: HuntLedgerItem[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.itemId !== 'string' ||
      typeof item.name !== 'string' ||
      !isFiniteNumber(item.quantity)
    ) {
      return null;
    }
    items.push({ itemId: item.itemId, name: item.name, quantity: item.quantity });
  }
  return items;
}

function readWave(value: unknown): HuntWaveEvent | null {
  if (
    !isRecord(value) ||
    typeof value.abilitySlug !== 'string' ||
    !isElement(value.element) ||
    typeof value.id !== 'string' ||
    !isFiniteNumber(value.startedAt) ||
    !Array.isArray(value.tiles)
  ) {
    return null;
  }
  const tiles: HuntWaveTile[] = [];
  for (const tile of value.tiles) {
    if (!isRecord(tile) || !isFiniteNumber(tile.arrivalAt) || !isTile(tile.tile)) {
      return null;
    }
    tiles.push({ arrivalAt: tile.arrivalAt, tile: tile.tile });
  }
  return {
    abilitySlug: value.abilitySlug,
    element: value.element,
    id: value.id,
    startedAt: value.startedAt,
    tiles,
  };
}
