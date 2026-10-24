import { expect, test } from 'bun:test';

import type { HuntRuntimeEvent } from '@creatures/contracts/huntSim';

import {
  buildEventIndex,
  latestAbilityCast,
  latestDamageAt,
} from '~/entities/hunt/model/huntEvents';

const CASTER = 'creature-1';

function castEvent(at: number, targetTile?: { x: number; y: number }): HuntRuntimeEvent {
  return { abilitySlug: 'jato', actorId: CASTER, at, targetTile, type: 'ability_cast' };
}

function damageEvent(at: number, actorId: string): HuntRuntimeEvent {
  return { actorId, amount: 5, at, element: 'water', targetId: 'other', type: 'damage' };
}

/**
 * The latest cast wins, and its target comes along.
 */
test('the latest cast is the one read', function latestCast(): void {
  const events = [castEvent(100, { x: 1, y: 1 }), castEvent(200, { x: 2, y: 2 })];
  const cast = latestAbilityCast(events, CASTER);
  expect(cast?.at).toBe(200);
  expect(cast?.targetTile).toEqual({ x: 2, y: 2 });
});

/**
 * A cast without a target still starts the strike.
 */
test('a cast without a target resolves with a null tile', function castWithoutTarget(): void {
  const cast = latestAbilityCast([castEvent(100)], CASTER);
  expect(cast?.at).toBe(100);
  expect(cast?.targetTile).toBeNull();
});

/**
 * The latest hit of an actor is the damage the flash follows.
 */
test('the latest damage of an actor is read', function latestDamage(): void {
  const events = [damageEvent(100, CASTER), damageEvent(300, CASTER)];
  expect(latestDamageAt(events, CASTER)).toBe(300);
  expect(latestDamageAt(events, 'someone-else')).toBeNull();
});

test('the index keeps the death, the capture and the level-up of each actor', function indexesFacts(): void {
  const events: HuntRuntimeEvent[] = [
    { actorId: 'wild-1', at: 100, type: 'death' },
    {
      actorId: 'wild-1',
      at: 200,
      deviceItemId: 'device-1',
      speciesSlug: 'folha',
      success: true,
      type: 'capture',
    },
    { actorId: CASTER, at: 300, level: 2, type: 'level_up' },
  ];
  const index = buildEventIndex(events);
  expect(index.deaths.get('wild-1')).toBe(100);
  expect(index.captures.get('wild-1')?.success).toBe(true);
  expect(index.levelUps.get(CASTER)).toBe(300);
});
