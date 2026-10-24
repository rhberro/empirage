import type { HuntEndReason } from '@creatures/contracts/huntSession';
import type {
  HuntAbilityCooldown,
  HuntCaptureDevice,
  HuntConsumableSlot,
  HuntCreatureActor,
  HuntDelta,
  HuntEndedMessage,
  HuntLedger,
  HuntRuntimeEvent,
  HuntTeamMemberActor,
  HuntTrainerActor,
  HuntWaveEvent,
} from '@creatures/contracts/huntSim';

import type { HuntSnapshot } from '~/entities/hunt/model/huntStore';
import {
  isFiniteNumber,
  readAbilities,
  readActors,
  readCaptureDevice,
  readConsumables,
  readCreatureActor,
  readLedger,
  readSession,
  readStringArray,
  readTeam,
  readTrainer,
  readWaves,
} from '~/pages/play/model/huntProtocolActors';
import { readEvents } from '~/pages/play/model/huntProtocolEvents';

const END_REASONS: ReadonlySet<string> = new Set<HuntEndReason>([
  'stamina_depleted',
  'offline_session_expired',
  'no_viable_creature',
  'player_finalized',
  'trainer_switched',
]);

export type HuntPayload =
  | { kind: 'hunt_state'; snapshot: HuntSnapshot }
  | { kind: 'hunt_delta'; delta: HuntDelta }
  | { kind: 'hunt_ended'; ended: HuntEndedMessage };

/**
 * The hunt message of the type given, or null when the message does not make
 * sense. A type that is not of the hunt is not an error of this reader: the
 * caller keeps looking.
 */
export function readHuntPayload(type: unknown, value: object): HuntPayload | null {
  if (type === 'hunt_state') {
    return readHuntState(value);
  }
  if (type === 'hunt_delta') {
    return readHuntDelta(value);
  }
  if (type === 'hunt_ended') {
    return readHuntEnded(value);
  }
  return null;
}

function readHuntState(value: object): HuntPayload | null {
  const message = value as Record<string, unknown>;
  if (!isFiniteNumber(message.huntRev) || !isFiniteNumber(message.serverNow)) {
    return null;
  }
  const player = readCreatureActor(message.player);
  const session = readSession(message.session);
  const trainer = readTrainer(message.trainer);
  const ledger = readLedger(message.ledger);
  const abilities = readAbilities(message.abilities);
  const consumables = readConsumables(message.consumables);
  const deviceField = readDeviceField(message.device);
  const team = message.team === undefined ? [] : readTeam(message.team);
  const waves = readWaves(message.waves);
  const wilds = message.wilds === undefined ? undefined : readActors(message.wilds);
  if (
    player === null ||
    session === null ||
    trainer === null ||
    ledger === null ||
    abilities === null ||
    consumables === null ||
    !deviceField.valid ||
    team === null ||
    waves === null ||
    wilds === null
  ) {
    return null;
  }
  const snapshot: HuntSnapshot = {
    abilities,
    consumables,
    device: deviceField.device ?? null,
    huntRev: message.huntRev,
    ledger,
    player,
    serverNow: message.serverNow,
    session,
    team,
    trainer,
    waves,
    wilds: wilds ?? [],
  };
  return { kind: 'hunt_state', snapshot };
}

type DeltaBase = {
  at: number;
  events: HuntRuntimeEvent[];
  huntRev: number;
  removed: string[];
  upserts: HuntCreatureActor[];
};

type DeltaOptional = {
  abilities?: HuntAbilityCooldown[];
  consumables?: HuntConsumableSlot[];
  device?: HuntCaptureDevice | null;
  ledger?: HuntLedger;
  team?: HuntTeamMemberActor[];
  trainer?: HuntTrainerActor;
  waves?: HuntWaveEvent[];
};

function readHuntDelta(value: object): HuntPayload | null {
  const message = value as Record<string, unknown>;
  const base = readDeltaBase(message);
  const optional = readDeltaOptional(message);
  if (base === null || optional === null) {
    return null;
  }
  return { delta: mergeDelta(base, optional), kind: 'hunt_delta' };
}

function readDeltaBase(message: Record<string, unknown>): DeltaBase | null {
  if (!isFiniteNumber(message.at) || !isFiniteNumber(message.huntRev)) {
    return null;
  }
  const events = readEvents(message.events);
  const removed = readStringArray(message.removed);
  const upserts = readActors(message.upserts);
  if (events === null || removed === null || upserts === null) {
    return null;
  }
  return {
    at: message.at,
    events,
    huntRev: message.huntRev,
    removed,
    upserts,
  };
}

function readDeltaOptional(message: Record<string, unknown>): DeltaOptional | null {
  const equipment = readDeltaEquipment(message);
  const meta = readDeltaMeta(message);
  if (equipment === null || meta === null) {
    return null;
  }
  return { ...equipment, ...meta };
}

function readDeltaEquipment(message: Record<string, unknown>): DeltaOptional | null {
  const abilities = readOptional(message.abilities, readAbilities);
  const consumables = readOptional(message.consumables, readConsumables);
  const deviceField = readDeviceField(message.device);
  const team = message.team === undefined ? undefined : readTeam(message.team);
  if (abilities === null || consumables === null || !deviceField.valid || team === null) {
    return null;
  }
  return { abilities, consumables, device: deviceField.device, team };
}

function readDeltaMeta(message: Record<string, unknown>): DeltaOptional | null {
  const ledger = readOptional(message.ledger, readLedger);
  const trainer = readOptional(message.trainer, readTrainer);
  const waves = readOptional(message.waves, readWaves);
  if (ledger === null || trainer === null || waves === null) {
    return null;
  }
  return { ledger, trainer, waves };
}

function mergeDelta(base: DeltaBase, optional: DeltaOptional): HuntDelta {
  const delta: HuntDelta = {
    at: base.at,
    events: base.events,
    huntRev: base.huntRev,
    removed: base.removed,
    upserts: base.upserts,
  };
  if (optional.abilities !== undefined) {
    delta.abilities = optional.abilities;
  }
  if (optional.consumables !== undefined) {
    delta.consumables = optional.consumables;
  }
  if (optional.device !== undefined) {
    delta.device = optional.device;
  }
  if (optional.team !== undefined) {
    delta.team = optional.team;
  }
  if (optional.waves !== undefined) {
    delta.waves = optional.waves;
  }
  if (optional.ledger !== undefined) {
    delta.ledger = optional.ledger;
  }
  if (optional.trainer !== undefined) {
    delta.trainer = optional.trainer;
  }
  return delta;
}

function readHuntEnded(value: object): HuntPayload | null {
  const message = value as Record<string, unknown>;
  if (!isFiniteNumber(message.huntRev) || !isEndReason(message.reason)) {
    return null;
  }
  const ledger = readLedger(message.ledger);
  if (ledger === null) {
    return null;
  }
  return {
    ended: { huntRev: message.huntRev, ledger, reason: message.reason },
    kind: 'hunt_ended',
  };
}

function isEndReason(value: unknown): value is HuntEndReason {
  return typeof value === 'string' && END_REASONS.has(value);
}

type DeviceField = {
  device: HuntCaptureDevice | null | undefined;
  valid: boolean;
};

/**
 * Reads the device of a message.
 *
 * Unlike the other optional fields, the absence and the null are different:
 * the absence means the message did not carry the device, while the null is
 * the hunt saying that nothing is equipped.
 */
function readDeviceField(value: unknown): DeviceField {
  if (value === undefined) {
    return { device: undefined, valid: true };
  }
  if (value === null) {
    return { device: null, valid: true };
  }
  const device = readCaptureDevice(value);
  return { device, valid: device !== null };
}

function readOptional<T>(
  value: unknown,
  reader: (candidate: unknown) => T | null,
): T | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  return reader(value);
}
