import type { HuntRuntimeEvent } from '@creatures/contracts/huntSim';
import type { Tile } from '@creatures/contracts/world';

/**
 * How long a target cast lingers on screen.
 */
export const CAST_PROJECTILE_MS = 260;

/**
 * How long a creature flashes after being hit.
 */
export const DAMAGE_FLASH_MS = 220;

export type AbilityCast = {
  actorId: string;
  at: number;
  impactAt: number | null;
  targetTile: Tile | null;
  travelMs: number | null;
};

/**
 * The latest cast and the latest hit of every actor, built once per frame.
 *
 * The creature layer used to scan the whole event window for every actor, which
 * is O(actors × events) on every frame. The index is O(events) and the layer
 * then reads a map.
 */
export type HuntCaptureEvent = Extract<HuntRuntimeEvent, { type: 'capture' }>;

export type HuntEventIndex = {
  captures: Map<string, HuntCaptureEvent>;
  casts: Map<string, AbilityCast>;
  damagedAt: Map<string, number>;
  deaths: Map<string, number>;
  levelUps: Map<string, number>;
};

export function buildEventIndex(events: HuntRuntimeEvent[]): HuntEventIndex {
  const captures = new Map<string, HuntCaptureEvent>();
  const casts = new Map<string, AbilityCast>();
  const damagedAt = new Map<string, number>();
  const deaths = new Map<string, number>();
  const levelUps = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'ability_cast') {
      const current = casts.get(event.actorId);
      if (current === undefined || event.at > current.at) {
        casts.set(event.actorId, {
          actorId: event.actorId,
          at: event.at,
          impactAt: event.impactAt ?? null,
          targetTile: event.targetTile ?? null,
          travelMs: event.travelMs ?? null,
        });
      }
      continue;
    }
    if (event.type === 'capture') {
      const current = captures.get(event.actorId);
      if (current === undefined || event.at >= current.at) {
        captures.set(event.actorId, event);
      }
      continue;
    }
    if (event.type === 'damage') {
      const current = damagedAt.get(event.targetId);
      if (current === undefined || event.at > current) {
        damagedAt.set(event.targetId, event.at);
      }
      continue;
    }
    if (event.type === 'death') {
      const current = deaths.get(event.actorId);
      if (current === undefined || event.at > current) {
        deaths.set(event.actorId, event.at);
      }
      continue;
    }
    if (event.type === 'level_up') {
      const current = levelUps.get(event.actorId);
      if (current === undefined || event.at > current) {
        levelUps.set(event.actorId, event.at);
      }
    }
  }
  return { captures, casts, damagedAt, deaths, levelUps };
}

/**
 * The most recent cast of an actor, whatever direction it went.
 *
 * The cast is the event that starts the strike animation, so only the latest
 * one matters: the creature is either striking or it is not.
 */
export function latestAbilityCast(events: HuntRuntimeEvent[], actorId: string): AbilityCast | null {
  let latest: AbilityCast | null = null;
  for (const event of events) {
    if (event.type !== 'ability_cast' || event.actorId !== actorId) {
      continue;
    }
    if (latest === null || event.at > latest.at) {
      latest = {
        actorId: event.actorId,
        at: event.at,
        impactAt: event.impactAt ?? null,
        targetTile: event.targetTile ?? null,
        travelMs: event.travelMs ?? null,
      };
    }
  }
  return latest;
}

/**
 * The moment an actor was last hit, or null when it has not been hit recently.
 *
 * The caller compares it against the clock to decide whether to flash.
 */
export function latestDamageAt(events: HuntRuntimeEvent[], actorId: string): number | null {
  let latest: number | null = null;
  for (const event of events) {
    if (event.type !== 'damage' || event.actorId !== actorId) {
      continue;
    }
    if (latest === null || event.at > latest) {
      latest = event.at;
    }
  }
  return latest;
}
