/* eslint-disable max-lines -- the snapshot and the incremental delta share the mapping helpers */
import type {
  HuntAbilityCooldown,
  HuntCaptureDevice,
  HuntCreatureActor,
  HuntConsumableSlot,
  HuntDelta,
  HuntLedger,
  HuntRuntimeEvent,
  HuntSnapshot,
  HuntTeamMemberActor,
  HuntTrainerActor,
  HuntWaveEvent,
} from '@creatures/contracts/huntSim';

import type { HuntRuntime } from '~/hunt/runtime/types';
import type {
  SimCreature,
  SimDevice,
  SimState,
  SimTeamMember,
  SimTrainer,
  SimWave,
} from '~/hunt/sim';
import { activeCreature } from '~/hunt/sim';

/**
 * The snapshot of the hunt.
 *
 * The wild creatures travel in the snapshot since the beginning of the fight:
 * a connection that enters a hunt already in progress learns them from here,
 * and keeps them from the deltas.
 */
export type HuntSnapshotWire = HuntSnapshot;

/**
 * The whole state a connection receives when it enters the hunt.
 */
export function toSnapshot(runtime: HuntRuntime, now: number): HuntSnapshot {
  const state = runtime.state;
  const active = activeCreature(state);
  const snapshot: HuntSnapshotWire = {
    abilities: toAbilityCooldowns(active),
    consumables: toConsumables(active),
    device: toDevice(state.device),
    huntRev: runtime.huntRev,
    ledger: toLedger(state.ledger),
    player: toCreatureActor(runtime, active),
    serverNow: now,
    session: {
      areaName: runtime.areaName,
      areaSlug: runtime.areaSlug,
      endsAt: runtime.endsAt,
      id: runtime.sessionId,
      startedAt: runtime.startedAt,
      status: 'active',
    },
    team: toTeam(state, runtime),
    trainer: toTrainerActor(state.trainer),
    waves: state.waves.map(function mapWave(wave: SimWave): HuntWaveEvent {
      return toWave(wave);
    }),
    wilds: state.wilds.map(function mapWild(wild: SimCreature): HuntCreatureActor {
      return toCreatureActor(runtime, wild);
    }),
  };
  // The snapshot is the full truth of the connection: the next delta only
  // carries what changes after it.
  resetDelivered(runtime);
  return snapshot;
}

/**
 * What changed since the previous message.
 *
 * The delta is a diff, not a portrait: an actor travels only when its life,
 * facing, target, behavior or step changed, and a cooldown, a wave or the
 * ledger travels only when it changed. The client keeps what the delta omits.
 */
export function toDelta(
  runtime: HuntRuntime,
  events: HuntRuntimeEvent[],
  removed: string[],
  now: number,
): HuntDelta {
  const state = runtime.state;
  const active = activeCreature(state);
  const delta: HuntDelta = {
    at: now,
    events,
    huntRev: runtime.huntRev,
    removed,
    upserts: readUpserts(runtime, active),
  };
  applyKitDelta(runtime, state, active, delta);
  applySceneDelta(runtime, state, delta);
  return delta;
}

/**
 * The diff of what the active creature and the trainer carry.
 */
function applyKitDelta(
  runtime: HuntRuntime,
  state: SimState,
  active: SimTeamMember,
  delta: HuntDelta,
): void {
  const abilities = toAbilityCooldowns(active);
  const abilitiesSignature = readAbilitiesSignature(abilities);
  if (abilitiesSignature !== runtime.delivered.abilities) {
    runtime.delivered.abilities = abilitiesSignature;
    delta.abilities = abilities;
  }
  const consumables = toConsumables(active);
  const consumablesSignature = readConsumablesSignature(consumables);
  if (consumablesSignature !== runtime.delivered.consumables) {
    runtime.delivered.consumables = consumablesSignature;
    delta.consumables = consumables;
  }
  const device = toDevice(state.device);
  const deviceSignature = readDeviceSignature(device);
  if (deviceSignature !== runtime.delivered.device) {
    runtime.delivered.device = deviceSignature;
    delta.device = device;
  }
  const team = toTeam(state, runtime);
  const teamSignature = readTeamSignature(team);
  if (teamSignature !== runtime.delivered.team) {
    runtime.delivered.team = teamSignature;
    delta.team = team;
  }
}

/**
 * The diff of what happens on the field.
 */
function applySceneDelta(runtime: HuntRuntime, state: SimState, delta: HuntDelta): void {
  const waves = state.waves.map(toWave);
  const wavesSignature = readWavesSignature(waves);
  if (wavesSignature !== runtime.delivered.waves) {
    runtime.delivered.waves = wavesSignature;
    delta.waves = waves;
  }
  const ledgerSignature = readLedgerSignature(state.ledger);
  if (ledgerSignature !== runtime.delivered.ledger) {
    runtime.delivered.ledger = ledgerSignature;
    delta.ledger = toLedger(state.ledger);
  }
  const trainer = toTrainerActor(state.trainer);
  const trainerSignature = readTrainerSignature(trainer);
  if (trainerSignature !== runtime.delivered.trainer) {
    runtime.delivered.trainer = trainerSignature;
    delta.trainer = trainer;
  }
}

/**
 * Whether a delta carries anything the client has to apply.
 *
 * An advance that only moved the cursor produces an empty delta; publishing it
 * would spend a revision and a message for nothing.
 */
export function isEmptyDelta(delta: HuntDelta): boolean {
  return (
    delta.abilities === undefined &&
    delta.consumables === undefined &&
    delta.device === undefined &&
    delta.events.length === 0 &&
    delta.ledger === undefined &&
    delta.removed.length === 0 &&
    delta.team === undefined &&
    delta.trainer === undefined &&
    delta.upserts.length === 0 &&
    delta.waves === undefined
  );
}

/**
 * Makes the current state the baseline of the next delta.
 *
 * A snapshot is the full state; after it, only the changes need to travel.
 */
export function resetDelivered(runtime: HuntRuntime): void {
  const state = runtime.state;
  const active = activeCreature(state);
  const actors = [toCreatureActor(runtime, active)];
  for (const wild of state.wilds) {
    actors.push(toCreatureActor(runtime, wild));
  }
  const delivered: HuntRuntime['delivered'] = {
    abilities: readAbilitiesSignature(toAbilityCooldowns(active)),
    actors: new Map<string, string>(),
    consumables: readConsumablesSignature(toConsumables(active)),
    device: readDeviceSignature(toDevice(state.device)),
    ledger: readLedgerSignature(state.ledger),
    team: readTeamSignature(toTeam(state, runtime)),
    trainer: readTrainerSignature(toTrainerActor(state.trainer)),
    waves: readWavesSignature(state.waves.map(toWave)),
  };
  for (const actor of actors) {
    delivered.actors.set(actor.id, readActorSignature(actor));
  }
  runtime.delivered = delivered;
}

function readUpserts(runtime: HuntRuntime, active: SimTeamMember): HuntCreatureActor[] {
  const upserts: HuntCreatureActor[] = [];
  const present = new Set<string>();
  const actors = [toCreatureActor(runtime, active)];
  for (const wild of runtime.state.wilds) {
    actors.push(toCreatureActor(runtime, wild));
  }
  for (const actor of actors) {
    present.add(actor.id);
    const signature = readActorSignature(actor);
    if (runtime.delivered.actors.get(actor.id) !== signature) {
      upserts.push(actor);
      runtime.delivered.actors.set(actor.id, signature);
    }
  }
  for (const id of runtime.delivered.actors.keys()) {
    if (!present.has(id)) {
      runtime.delivered.actors.delete(id);
    }
  }
  return upserts;
}

function readActorSignature(actor: HuntCreatureActor): string {
  const segment = actor.segment;
  return [
    actor.hp,
    actor.dir,
    actor.targetId ?? '',
    actor.behavior ?? '',
    segment?.startsAt ?? '',
    segment?.endsAt ?? '',
    segment?.from.x ?? '',
    segment?.from.y ?? '',
    segment?.to.x ?? '',
    segment?.to.y ?? '',
  ].join('|');
}

function readTrainerSignature(trainer: HuntTrainerActor): string {
  const segment = trainer.segment;
  return [
    trainer.dir,
    segment?.startsAt ?? '',
    segment?.endsAt ?? '',
    segment?.from.x ?? '',
    segment?.from.y ?? '',
    segment?.to.x ?? '',
    segment?.to.y ?? '',
  ].join('|');
}

function readAbilitiesSignature(abilities: HuntAbilityCooldown[]): string {
  return abilities
    .map(function read(ability): string {
      return [ability.slot, ability.abilitySlug, ability.readyAt, ability.cooldownMs].join(':');
    })
    .join(',');
}

function readConsumablesSignature(consumables: HuntConsumableSlot[]): string {
  return consumables
    .map(function read(consumable): string {
      return [
        consumable.slot,
        consumable.itemId,
        consumable.quantity,
        consumable.readyAt,
        consumable.triggerHpPercent,
      ].join(':');
    })
    .join(',');
}

function readDeviceSignature(device: HuntCaptureDevice | null): string {
  if (device === null) {
    return 'null';
  }
  return [device.itemId, device.multiplier, device.quantity, device.slot].join(':');
}

function readTeamSignature(team: HuntTeamMemberActor[]): string {
  return team
    .map(function read(member): string {
      return [member.id, member.fainted, member.level, member.speciesSlug].join(':');
    })
    .join(',');
}

function readWavesSignature(waves: HuntWaveEvent[]): string {
  return waves
    .map(function read(wave): string {
      return [wave.id, wave.startedAt, wave.tiles.length].join(':');
    })
    .join(',');
}

function readLedgerSignature(ledger: HuntLedger): string {
  const drops = ledger.drops
    .map(function read(drop): string {
      return [drop.itemId, drop.quantity].join(':');
    })
    .join(',');
  const spent = ledger.spent
    .map(function read(item): string {
      return [item.itemId, item.quantity].join(':');
    })
    .join(',');
  return [ledger.encounters, ledger.experience, ledger.kills, drops, spent].join('|');
}

/**
 * One creature in the field.
 */
export function toCreatureActor(runtime: HuntRuntime, creature: SimCreature): HuntCreatureActor {
  const actor: HuntCreatureActor = {
    dir: creature.dir,
    hp: creature.hp,
    id: creature.id,
    kind: creature.kind,
    level: creature.level,
    maxHp: creature.maxHp,
    speciesName: runtime.content.species[creature.speciesSlug]?.name ?? creature.speciesSlug,
    speciesSlug: creature.speciesSlug,
    tile: { x: creature.tile.x, y: creature.tile.y },
  };
  if (creature.kind === 'wild') {
    actor.behavior = readWildBehavior(creature);
  }
  if (creature.segment !== undefined && creature.segment !== null) {
    actor.segment = creature.segment;
  }
  if (creature.targetId !== null && creature.targetId !== undefined) {
    actor.targetId = creature.targetId;
  }
  return actor;
}

/**
 * The trainer that follows the active creature.
 */
export function toTrainerActor(trainer: SimTrainer): HuntTrainerActor {
  const actor: HuntTrainerActor = {
    dir: trainer.dir,
    tile: { x: trainer.tile.x, y: trainer.tile.y },
  };
  if (trainer.segment !== undefined && trainer.segment !== null) {
    actor.segment = trainer.segment;
  }
  return actor;
}

/**
 * An area wave in flight.
 */
export function toWave(wave: SimWave): HuntWaveEvent {
  return {
    abilitySlug: wave.abilitySlug,
    element: wave.element,
    id: wave.id,
    startedAt: wave.startedAt,
    tiles: wave.tiles.map(function mapTile(entry: {
      arrivalAt: number;
      tile: { x: number; y: number };
    }) {
      return { arrivalAt: entry.arrivalAt, tile: { x: entry.tile.x, y: entry.tile.y } };
    }),
  };
}

/**
 * The cooldown of the abilities of the active creature, with the empty slots
 * omitted.
 */
export function toAbilityCooldowns(active: SimTeamMember): HuntAbilityCooldown[] {
  const cooldowns: HuntAbilityCooldown[] = [];
  for (let slot = 0; slot < active.abilities.length; slot += 1) {
    const ability = active.abilities[slot];
    if (ability === undefined || ability === null) {
      continue;
    }
    cooldowns.push({
      abilitySlug: ability.slug,
      cooldownMs: ability.cooldownMs,
      element: ability.element,
      name: ability.name,
      readyAt: active.abilityReadyAt[slot] ?? 0,
      slot,
    });
  }
  return cooldowns;
}

/**
 * The consumable slots of the active creature, with the empty ones omitted.
 */
export function toConsumables(active: SimTeamMember): HuntConsumableSlot[] {
  const slots: HuntConsumableSlot[] = [];
  for (let index = 0; index < active.consumables.length; index += 1) {
    const consumable = active.consumables[index];
    if (consumable === undefined) {
      continue;
    }
    slots.push({
      itemId: consumable.itemId,
      name: consumable.name,
      quantity: consumable.quantity,
      readyAt: active.consumableReadyAt[index] ?? 0,
      slot: consumable.slot,
      triggerHpPercent: consumable.triggerHpPercent,
    });
  }
  return slots;
}

/**
 * The capture device of the trainer, when one is equipped.
 */
function toDevice(device: SimDevice | null): HuntCaptureDevice | null {
  if (device === null) {
    return null;
  }
  return {
    itemId: device.itemId,
    multiplier: device.multiplier,
    name: device.name,
    quantity: device.quantity,
    slot: device.slot,
  };
}

/**
 * The team, with the live facts the team bar reads.
 */
function toTeam(state: SimState, runtime: HuntRuntime): HuntTeamMemberActor[] {
  return state.team.map(function mapMember(member: SimTeamMember): HuntTeamMemberActor {
    return {
      fainted: member.hp <= 0,
      id: member.creatureId,
      level: member.level,
      speciesName: runtime.content.species[member.speciesSlug]?.name ?? member.speciesSlug,
      speciesSlug: member.speciesSlug,
      teamSlot: member.teamSlot,
    };
  });
}

/**
 * The accounting of the hunt.
 */
export function toLedger(ledger: HuntLedger): HuntLedger {
  return {
    drops: ledger.drops.map(copyLedgerItem),
    encounters: ledger.encounters,
    experience: ledger.experience,
    kills: ledger.kills,
    spent: ledger.spent.map(copyLedgerItem),
  };
}

function copyLedgerItem(item: HuntLedger['drops'][number]): HuntLedger['drops'][number] {
  return { itemId: item.itemId, name: item.name, quantity: item.quantity };
}

function readWildBehavior(creature: SimCreature): HuntCreatureActor['behavior'] {
  if (creature.behavior === 'chase') {
    return 'chasing';
  }
  return 'idle';
}
