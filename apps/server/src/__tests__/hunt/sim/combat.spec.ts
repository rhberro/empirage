/* eslint-disable max-lines -- the combat scenarios share the fixtures and the helpers */
import { expect, test } from 'bun:test';

import {
  ABILITY_A,
  LINE_ABILITY,
  START,
  buildContent,
  buildState,
  buildTeamMember,
  buildWild,
} from '~/__tests__/hunt/sim/fixtures';
import {
  addWild,
  counters,
  hugeWild,
  isConsumableUsed,
  isHeal,
  readActive,
  readCasts,
  readDamage,
  readTeamMember,
} from '~/__tests__/hunt/sim/helpers';
import type { DamageEvent } from '~/__tests__/hunt/sim/helpers';
import { CORPSE_LINGER_MS, resolveCaptures, respawnWilds } from '~/hunt/sim/deaths';
import { advanceUntil, finalizeHunt } from '~/hunt/sim/simulate';
import type { SimEvent } from '~/hunt/sim/types';

function theProjectileLandsAtTheImpact(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ abilities: [PROJECTILE_ABILITY], consumables: [] })],
  });
  const wild = buildWild(content, { x: 6, y: 5 }, 'brasa', 'wild-1');
  wild.meleeReadyAt = START + 1_000_000;
  hugeWild(state, wild);
  addWild(state, wild);

  const before = advanceUntil(state, START + 299, content);
  const casts = readCasts(before.events, readActive(state).id);
  expect(casts.length).toBe(1);
  expect(casts[0]?.impactAt).toBe(START + 300);
  expect(casts[0]?.travelMs).toBe(300);
  expect(readDamage(before.events).length).toBe(0);
  expect(state.projectiles.length).toBe(1);

  const atImpact = advanceUntil(state, START + 300, content);
  const damage = readDamage(atImpact.events);
  expect(damage.length).toBe(1);
  expect(damage[0]?.at).toBe(START + 300);
  expect(state.projectiles.length).toBe(0);
}

function theLineHitsEachTileOnce(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ abilities: [LINE_ABILITY], consumables: [] })],
  });
  const first = buildWild(content, { x: 6, y: 5 }, 'broto', 'wild-1');
  const second = buildWild(content, { x: 8, y: 5 }, 'broto', 'wild-2');
  const third = buildWild(content, { x: 9, y: 5 }, 'broto', 'wild-3');
  hugeWild(state, first);
  hugeWild(state, second);
  hugeWild(state, third);
  const result = advanceUntil(state, START + 799, content);
  const damage = readDamage(result.events);
  expect(counters(damage, 'wild-1')).toEqual([START + 200]);
  expect(counters(damage, 'wild-2')).toEqual([START + 600]);
  expect(counters(damage, 'wild-3')).toEqual([]);
  const last = advanceUntil(state, START + 800, content);
  expect(counters(readDamage(last.events), 'wild-3')).toEqual([START + 800]);
  expect(counters(damage, 'wild-1')).toEqual([START + 200]);
  expect(counters(damage, 'wild-2')).toEqual([START + 600]);
  for (const event of damage) {
    expect(event.abilitySlug).toBe('line');
  }
}

function theWildMeleeHitsOncePerTwoSeconds(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  const wild = buildWild(content, { x: 6, y: 5 }, 'broto', 'wild-melee');
  wild.nextDecisionAt = START;
  wild.meleeReadyAt = START;
  addWild(state, wild);
  const result = advanceUntil(state, START + 5000, content);
  const melee = readCasts(result.events, 'wild-melee');
  expect(melee.length).toBe(3);
  for (let index = 1; index < melee.length; index += 1) {
    expect(melee[index]?.at).toBe((melee[index - 1]?.at ?? 0) + 2000);
  }
  const damage = readDamage(result.events).filter(function isMelee(event: DamageEvent): boolean {
    return event.abilitySlug === 'melee';
  });
  expect(damage.length).toBe(3);
  for (const event of damage) {
    expect(event.amount).toBeGreaterThanOrEqual(1);
  }
}

function theConsumableHealsAndRespectsTheCooldown(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ consumables: [POTION], currentHp: 10 })],
  });
  const first = advanceUntil(state, START + 1, content);
  expect(first.events.filter(isHeal).length).toBe(1);
  expect(first.events.filter(isConsumableUsed).length).toBe(1);
  expect(readActive(state).hp).toBe(35);
  expect(readActive(state).consumables[0]?.quantity).toBe(1);
  advanceUntil(state, START + 1999, content);
  expect(readActive(state).consumables[0]?.quantity).toBe(1);
  advanceUntil(state, START + 2000, content);
  expect(readActive(state).consumables[0]?.quantity).toBe(0);
  expect(readActive(state).hp).toBe(60);
}

function theConsumableDoesNotFireAboveTheTrigger(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [buildTeamMember({ consumables: [POTION], currentHp: 90 })],
  });
  const result = advanceUntil(state, START + 3000, content);
  expect(result.events.filter(isConsumableUsed).length).toBe(0);
  expect(readActive(state).consumables[0]?.quantity).toBe(2);
}

function theActiveDeathBringsTheNextOne(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [
      buildTeamMember({ creatureId: 'creature-1' }),
      buildTeamMember({ creatureId: 'creature-2' }),
    ],
  });
  const tile = { x: readActive(state).tile.x, y: readActive(state).tile.y };
  readTeamMember(state, 'creature-1').hp = 0;
  const result = advanceUntil(state, START + 1, content);
  expect(state.activeCreatureId).toBe('creature-2');
  expect(readActive(state).tile).toEqual(tile);
  expect(readActive(state).behavior).toBe('loop');
  expect(
    result.events.filter(function isDeath(event: SimEvent): boolean {
      return event.type === 'death' && event.actorId === 'creature-1';
    }).length,
  ).toBe(1);
}

function theTeamWithoutALivingCreatureEnds(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({
    content,
    team: [
      buildTeamMember({ creatureId: 'creature-1' }),
      buildTeamMember({ creatureId: 'creature-2' }),
    ],
  });
  readTeamMember(state, 'creature-1').hp = 0;
  readTeamMember(state, 'creature-2').hp = 0;
  advanceUntil(state, START + 1, content);
  expect(state.ended).toBe(true);
  expect(state.endReason).toBe('no_viable_creature');
  expect(state.simulatedAt).toBe(START);
}

function theWildRespawnsAfterTheDelay(): void {
  const content = buildContent({
    spawns: [{ level: 1, respawnMs: 5000, species: 'brasa', x: 8, y: 7 }],
  });
  const state = buildState({ content });
  const wild = state.wilds[0];
  if (wild === undefined) {
    return;
  }
  wild.hp = 0;
  advanceUntil(state, START + 1, content);
  // The wild stays as a corpse until the capture attempt, and the spawn only
  // starts counting from that moment.
  expect(state.wilds.length).toBe(1);
  expect(state.wilds[0]?.behavior).toBe('dead');
  expect(state.spawns[0]?.respawnAt).toBeNull();
  advanceUntil(state, START + CORPSE_LINGER_MS - 1, content);
  expect(state.wilds.length).toBe(1);
  const captureAt = START + CORPSE_LINGER_MS;
  advanceUntil(state, captureAt, content);
  expect(state.wilds.length).toBe(0);
  expect(state.spawns[0]?.respawnAt).toBe(captureAt + 5000);
  advanceUntil(state, captureAt + 4999, content);
  expect(state.wilds.length).toBe(0);
  const result = advanceUntil(state, captureAt + 5000, content);
  expect(state.wilds.length).toBe(1);
  expect(state.spawns[0]?.wildId).toBe(state.wilds[0]?.id);
  expect(
    result.events.filter(function isSpawn(event: SimEvent): boolean {
      return event.type === 'spawn';
    }).length,
  ).toBe(1);
}

function theBusySpawnWaits(): void {
  const content = buildContent({
    spawns: [{ level: 1, respawnMs: 5000, species: 'brasa', x: 8, y: 7 }],
  });
  const state = buildState({ content });
  const wild = state.wilds[0];
  if (wild === undefined) {
    return;
  }
  wild.hp = 0;
  advanceUntil(state, START + 1, content);
  const events: SimEvent[] = [];
  const captureAt = START + CORPSE_LINGER_MS;
  resolveCaptures(state, content, captureAt, events);
  expect(state.wilds.length).toBe(0);
  expect(state.spawns[0]?.respawnAt).toBe(captureAt + 5000);
  const active = readActive(state);
  active.tile = { x: 8, y: 7 };
  active.segment = undefined;
  respawnWilds(state, content, captureAt + 5000, events);
  expect(state.wilds.length).toBe(0);
  expect(state.spawns[0]?.respawnAt).toBe(captureAt + 6000);
  active.tile = { x: 5, y: 5 };
  respawnWilds(state, content, captureAt + 6000, events);
  expect(state.wilds.length).toBe(1);
}

function theLootAndTheExperienceAreCredited(): void {
  const content = buildContent({
    spawns: [{ level: 1, respawnMs: 5000, species: 'brasa', x: 8, y: 7 }],
  });
  const state = buildState({
    content,
    team: [
      buildTeamMember({ creatureId: 'creature-1' }),
      buildTeamMember({ creatureId: 'creature-2' }),
    ],
  });
  const wild = state.wilds[0];
  if (wild === undefined) {
    return;
  }
  wild.hp = 0;
  const death = advanceUntil(state, START + 1, content);
  expect(state.ledger.kills).toBe(1);
  expect(state.ledger.drops).toEqual([]);
  expect(state.ledger.experience).toBe(100);
  expect(readTeamMember(state, 'creature-1').experience).toBe(100);
  expect(readTeamMember(state, 'creature-2').experience).toBe(10);
  expect(
    death.events.filter(function isExperience(event: SimEvent): boolean {
      return event.type === 'experience';
    }).length,
  ).toBe(1);
  const result = advanceUntil(state, START + CORPSE_LINGER_MS, content);
  expect(state.ledger.drops).toEqual([{ itemId: 'ember', name: 'Ember', quantity: 1 }]);
  expect(
    result.events.filter(function isLoot(event: SimEvent): boolean {
      return event.type === 'loot';
    }).length,
  ).toBe(1);
}

function theZeroChanceDoesNotDrop(): void {
  const content = buildContent({
    spawns: [{ level: 1, respawnMs: 5000, species: 'broto', x: 8, y: 7 }],
  });
  const state = buildState({ content });
  const wild = state.wilds[0];
  if (wild === undefined) {
    return;
  }
  wild.hp = 0;
  const result = advanceUntil(state, START + CORPSE_LINGER_MS, content);
  expect(state.ledger.drops).toEqual([]);
  expect(
    result.events.filter(function isLoot(event: SimEvent): boolean {
      return event.type === 'loot';
    }).length,
  ).toBe(0);
}

function theHuntEndsAtTheWindow(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content, endsAt: START + 5000 });
  const result = advanceUntil(state, START + 10_000, content);
  expect(state.ended).toBe(true);
  expect(state.endReason).toBe('offline_session_expired');
  expect(state.simulatedAt).toBe(START + 5000);
  for (const event of result.events) {
    expect(event.at).toBeLessThanOrEqual(START + 5000);
  }
}

function thePlayerFinalizesTheHunt(): void {
  const content = buildContent({ spawns: [] });
  const state = buildState({ content });
  finalizeHunt(state, START + 1234);
  expect(state.ended).toBe(true);
  expect(state.endReason).toBe('player_finalized');
  expect(state.endsAt).toBe(START + 1234);
}

const POTION = {
  cooldownMs: 2000,
  healPercent: 25,
  itemId: 'potion',
  name: 'Potion',
  quantity: 2,
  slot: 4,
  triggerHpPercent: 50,
};

const PROJECTILE_ABILITY = {
  ...ABILITY_A,
  damage: 10,
  name: 'Fireball',
  slug: 'fireball',
  travelMs: 300,
};

test('the projectile lands at the impact', theProjectileLandsAtTheImpact);

test('the line hits each tile once', theLineHitsEachTileOnce);
test('the wild melee hits once per two seconds', theWildMeleeHitsOncePerTwoSeconds);
test('the consumable heals and respects the cooldown', theConsumableHealsAndRespectsTheCooldown);
test('the consumable does not fire above the trigger', theConsumableDoesNotFireAboveTheTrigger);
test('the active death brings the next creature', theActiveDeathBringsTheNextOne);
test('the team without a living creature ends the hunt', theTeamWithoutALivingCreatureEnds);
test('the wild respawns after the delay', theWildRespawnsAfterTheDelay);
test('the busy spawn waits', theBusySpawnWaits);
test('the loot and the experience are credited', theLootAndTheExperienceAreCredited);
test('a zero chance does not drop', theZeroChanceDoesNotDrop);
test('the hunt ends at the window', theHuntEndsAtTheWindow);
test('the player finalizes the hunt', thePlayerFinalizesTheHunt);
