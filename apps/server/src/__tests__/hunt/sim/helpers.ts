import { expect } from 'bun:test';

import type { PathSegment, Tile } from '@creatures/contracts/world';

import { TRAINER_ACTOR_ID } from '~/hunt/sim/occupancy';
import type { SimCreature, SimEvent, SimState } from '~/hunt/sim/types';
import { activeCreature, isAlive, sameTile } from '~/hunt/sim/types';

export type AbilityCastEvent = Extract<SimEvent, { type: 'ability_cast' }>;
export type ConsumableUsedEvent = Extract<SimEvent, { type: 'consumable_used' }>;
export type DamageEvent = Extract<SimEvent, { type: 'damage' }>;
export type HealEvent = Extract<SimEvent, { type: 'heal' }>;

export function isAbilityCast(event: SimEvent): event is AbilityCastEvent {
  return event.type === 'ability_cast';
}

export function isConsumableUsed(event: SimEvent): event is ConsumableUsedEvent {
  return event.type === 'consumable_used';
}

export function isDamage(event: SimEvent): event is DamageEvent {
  return event.type === 'damage';
}

export function isHeal(event: SimEvent): event is HealEvent {
  return event.type === 'heal';
}

export function readDamage(events: SimEvent[]): DamageEvent[] {
  return events.filter(isDamage);
}

export function readCasts(events: SimEvent[], actorId: string): AbilityCastEvent[] {
  return events.filter(isAbilityCast).filter(function belongsToActor(
    event: AbilityCastEvent,
  ): boolean {
    return event.actorId === actorId;
  });
}

export function addWild(state: SimState, wild: SimCreature): void {
  wild.spawnIndex = state.wilds.length;
  state.wilds.push(wild);
}

export function hugeWild(state: SimState, wild: SimCreature): void {
  wild.hp = 1_000_000;
  wild.maxHp = 1_000_000;
  addWild(state, wild);
}

export function containsTile(tiles: Tile[], tile: Tile): boolean {
  for (const candidate of tiles) {
    if (candidate.x === tile.x && candidate.y === tile.y) {
      return true;
    }
  }
  return false;
}

export function readActive(state: SimState): SimState['team'][number] {
  for (const member of state.team) {
    if (member.id === state.activeCreatureId) {
      return member;
    }
  }
  return state.team[0] as SimState['team'][number];
}

export function readTeamMember(state: SimState, id: string): SimState['team'][number] {
  for (const member of state.team) {
    if (member.id === id) {
      return member;
    }
  }
  return state.team[0] as SimState['team'][number];
}

export function counters(events: DamageEvent[], targetId: string): number[] {
  const moments: number[] = [];
  for (const event of events) {
    if (event.targetId === targetId) {
      moments.push(event.at);
    }
  }
  return moments;
}

/**
 * Asserts that no two actors share a confirmed tile or a step destination.
 *
 * The invariant is checked against the whole field: the active creature, the
 * trainer and every living wild.
 */
export function expectActorsApart(state: SimState): void {
  const active = activeCreature(state);
  const actors: { id: string; segment?: PathSegment; tile: Tile }[] = [
    { id: active.id, segment: active.segment, tile: active.tile },
    { id: TRAINER_ACTOR_ID, segment: state.trainer.segment, tile: state.trainer.tile },
  ];
  for (const wild of state.wilds) {
    if (isAlive(wild)) {
      actors.push({ id: wild.id, segment: wild.segment, tile: wild.tile });
    }
  }
  for (let left = 0; left < actors.length; left += 1) {
    for (let right = left + 1; right < actors.length; right += 1) {
      const first = actors[left] as { id: string; segment?: PathSegment; tile: Tile };
      const second = actors[right] as { id: string; segment?: PathSegment; tile: Tile };
      expect(sameTile(first.tile, second.tile)).toBe(false);
      if (first.segment !== undefined) {
        expect(sameTile(first.segment.to, second.tile)).toBe(false);
        if (second.segment !== undefined) {
          expect(sameTile(first.segment.to, second.segment.to)).toBe(false);
        }
      }
      if (second.segment !== undefined) {
        expect(sameTile(second.segment.to, first.tile)).toBe(false);
      }
    }
  }
}
