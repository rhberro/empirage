import type { Potential } from './creature';
import type { HuntEndReason } from './huntSession';
import type { Element } from './species';
import type { Direction, PathSegment, Tile } from './world';

export type HuntActorKind = 'player' | 'wild';

export type HuntWildBehavior = 'idle' | 'chasing' | 'attacking';

export type HuntLedgerItem = {
  itemId: string;
  name: string;
  quantity: number;
};

export type HuntCreatureActor = {
  behavior?: HuntWildBehavior;
  dir: Direction;
  hp: number;
  id: string;
  kind: HuntActorKind;
  level: number;
  maxHp: number;
  segment?: PathSegment;
  speciesName: string;
  speciesSlug: string;
  targetId?: string;
  tile: Tile;
};

/**
 * The capture device the trainer carries, when one is equipped.
 *
 * `multiplier` is the factor over the species capture chance (1×, 2×, …). The
 * quantity is how many of that device the backpack still holds.
 */
export type HuntCaptureDevice = {
  itemId: string;
  multiplier: number;
  name: string;
  quantity: number;
  slot: number;
};

/**
 * One creature of the team, with the live facts the team bar needs.
 *
 * `id` is the creature id, the same one the team bar already uses. `fainted`
 * is true when the creature has no life left and no longer battles.
 */
export type HuntTeamMemberActor = {
  fainted: boolean;
  id: string;
  level: number;
  speciesName: string;
  speciesSlug: string;
  /** The team slot (1–5) the creature occupies, for the bar order. */
  teamSlot: number;
};

export type HuntTrainerActor = {
  dir: Direction;
  segment?: PathSegment;
  tile: Tile;
};

export type HuntWaveTile = {
  arrivalAt: number;
  tile: Tile;
};

export type HuntWaveEvent = {
  abilitySlug: string;
  element: Element;
  id: string;
  startedAt: number;
  tiles: HuntWaveTile[];
};

export type HuntAbilityCooldown = {
  abilitySlug: string;
  cooldownMs: number;
  element: Element;
  name: string;
  readyAt: number;
  slot: number;
};

export type HuntConsumableSlot = {
  itemId: string;
  name: string;
  quantity: number;
  readyAt: number;
  slot: number;
  triggerHpPercent: number;
};

export type HuntLedger = {
  drops: HuntLedgerItem[];
  encounters: number;
  experience: number;
  kills: number;
  spent: HuntLedgerItem[];
};

export type HuntSessionInfo = {
  areaName: string;
  areaSlug: string;
  endsAt: number;
  id: string;
  startedAt: number;
  status: 'active';
};

/**
 * The full hunt state a connection receives when it enters or reconnects.
 */
export type HuntSnapshot = {
  abilities: HuntAbilityCooldown[];
  consumables: HuntConsumableSlot[];
  device: HuntCaptureDevice | null;
  huntRev: number;
  ledger: HuntLedger;
  player: HuntCreatureActor;
  serverNow: number;
  session: HuntSessionInfo;
  team: HuntTeamMemberActor[];
  trainer: HuntTrainerActor;
  waves: HuntWaveEvent[];
  /** The wild creatures in the field when the snapshot was taken. */
  wilds: HuntCreatureActor[];
};

/**
 * One fact of the simulation, applied by the client in order.
 *
 * The events carry the moment they happened: the delta coalesces the frame,
 * but the client still animates each fact from its own timestamp.
 */
export type HuntRuntimeEvent =
  | { actorId: string; at: number; from: Tile; to: Tile; type: 'step' }
  | { actorId: string; at: number; targetId: string | null; type: 'target_changed' }
  | {
      abilitySlug: string;
      actorId: string;
      at: number;
      /** The moment the projectile lands, for a targeted ability. */
      impactAt?: number;
      targetTile?: Tile;
      /** How long the projectile flies, for a targeted ability. */
      travelMs?: number;
      type: 'ability_cast';
    }
  | {
      abilitySlug?: string;
      actorId: string;
      amount: number;
      at: number;
      element: Element;
      targetId: string;
      type: 'damage';
    }
  | { actorId: string; amount: number; at: number; type: 'heal' }
  | { actorId: string; at: number; killerId?: string; type: 'death' }
  | { actorId: string; at: number; spawnIndex: number; speciesSlug: string; type: 'spawn' }
  | { actorId: string; at: number; itemId: string; name: string; quantity: number; type: 'loot' }
  | { actorId: string; amount: number; at: number; type: 'experience' }
  | {
      actorId: string;
      at: number;
      deviceItemId: string;
      success: boolean;
      /** The species of the captured wild, always present. */
      speciesSlug: string;
      /** The id of the captured creature, present on success. */
      creatureId?: string;
      /** The random potential of the captured creature, present on success. */
      potential?: Potential;
      /** The team slot (1–5) the creature entered; undefined = storage. */
      teamSlot?: number;
      type: 'capture';
    }
  | { actorId: string; at: number; level: number; type: 'level_up' }
  | {
      actorId: string;
      at: number;
      itemId: string;
      name: string;
      quantity: number;
      type: 'consumable_used';
    };

export type HuntDelta = {
  /** The cooldowns, when they changed since the previous message. */
  abilities?: HuntAbilityCooldown[];
  at: number;
  /** The consumables, when their quantity or cooldown changed. */
  consumables?: HuntConsumableSlot[];
  /** The capture device, when it changed. */
  device?: HuntCaptureDevice | null;
  events: HuntRuntimeEvent[];
  huntRev: number;
  ledger?: HuntLedger;
  removed: string[];
  /** The team, when its life, level or fainted state changed. */
  team?: HuntTeamMemberActor[];
  trainer?: HuntTrainerActor;
  upserts: HuntCreatureActor[];
  /** The waves in flight, when the set changed. */
  waves?: HuntWaveEvent[];
};

export type HuntEndedMessage = {
  huntRev: number;
  ledger: HuntLedger;
  reason: HuntEndReason;
};
