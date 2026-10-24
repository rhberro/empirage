import { expect, test } from 'bun:test';

import { calculateAttribute, calculateMaxHp } from '@creatures/contracts/attributes';

import {
  BRASA,
  START,
  buildContent,
  buildState,
  buildTeamMember,
} from '~/__tests__/hunt/sim/fixtures';
import { readTeamMember } from '~/__tests__/hunt/sim/helpers';
import { CORPSE_LINGER_MS } from '~/hunt/sim/deaths';
import { advanceUntil } from '~/hunt/sim/simulate';
import type { SimContent, SimDevice, SimEvent } from '~/hunt/sim/types';

const SPAWN = { level: 1, respawnMs: 5000, species: 'brasa', x: 8, y: 7 } as const;

const DEVICE: SimDevice = {
  itemId: 'prisma',
  multiplier: 2,
  name: 'Prisma',
  quantity: 2,
  slot: 6,
};

function captureContent(captureChance: number): SimContent {
  return buildContent({
    spawns: [SPAWN],
    species: { brasa: { ...BRASA, captureChance } },
  });
}

function killTheWild(state: ReturnType<typeof buildState>, content: SimContent): SimEvent[] {
  const wild = state.wilds[0];
  if (wild === undefined) {
    throw new Error('the fixture has no wild');
  }
  wild.hp = 0;
  return advanceUntil(state, START + 1, content).events;
}

function resolveCorpse(state: ReturnType<typeof buildState>, content: SimContent): SimEvent[] {
  return advanceUntil(state, START + CORPSE_LINGER_MS, content).events;
}

function readCapture(events: SimEvent[]): Extract<SimEvent, { type: 'capture' }> | undefined {
  return events.find(function isCapture(event: SimEvent): boolean {
    return event.type === 'capture';
  }) as Extract<SimEvent, { type: 'capture' }> | undefined;
}

function theExperienceLevelsTheCreature(): void {
  const content = captureContent(0.05);
  const state = buildState({
    content,
    team: [
      buildTeamMember({ creatureId: 'creature-1', teamSlot: 1 }),
      buildTeamMember({ creatureId: 'creature-2', teamSlot: 2 }),
    ],
  });
  const active = readTeamMember(state, 'creature-1');
  const events = killTheWild(state, content);
  expect(active.experience).toBe(100);
  expect(active.level).toBe(2);
  expect(active.maxHp).toBe(calculateMaxHp(BRASA.base.vitality, 50, 2));
  expect(active.attributes.vitality).toBe(calculateAttribute(BRASA.base.vitality, 50, 2));
  // The life grows by the difference, so the creature is born at full life in
  // the new level instead of staying at the old cap.
  expect(active.hp).toBe(active.maxHp);
  const levelUps = events.filter(function isLevelUp(event: SimEvent): boolean {
    return event.type === 'level_up';
  });
  expect(levelUps).toEqual([{ actorId: 'creature-1', at: START, level: 2, type: 'level_up' }]);
  expect(readTeamMember(state, 'creature-2').level).toBe(1);
}

function theCaptureConsumesTheDeviceAndAddsTheCreature(): void {
  const content = captureContent(1);
  const state = buildState({
    content,
    device: { ...DEVICE },
    team: [buildTeamMember({ creatureId: 'creature-1', teamSlot: 1 })],
  });
  killTheWild(state, content);
  const events = resolveCorpse(state, content);
  expect(state.device?.quantity).toBe(1);
  expect(state.wilds.length).toBe(0);
  expect(state.team.length).toBe(2);
  const captured = state.team[1];
  expect(captured?.level).toBe(1);
  expect(captured?.experience).toBe(0);
  expect(captured?.hp).toBe(captured?.maxHp);
  expect(captured?.abilities).toEqual([null, null, null, null]);
  expect(captured?.consumables).toEqual([]);
  expect(captured?.teamSlot).toBe(2);
  for (const value of Object.values(captured?.potential ?? {})) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
    expect(Number.isInteger(value)).toBe(true);
  }
  const capture = readCapture(events);
  expect(capture?.success).toBe(true);
  expect(capture?.deviceItemId).toBe(DEVICE.itemId);
  expect(capture?.speciesSlug).toBe('brasa');
  expect(capture?.teamSlot).toBe(2);
  expect(capture?.potential).toEqual(captured?.potential);
  expect(state.ledger.drops).toEqual([]);
  expect(state.spawns[0]?.respawnAt).toBe(START + CORPSE_LINGER_MS + 5000);
}

function theFailedCaptureLootsAndRespawns(): void {
  const content = captureContent(0);
  const state = buildState({
    content,
    device: { ...DEVICE, quantity: 1 },
    team: [buildTeamMember({ creatureId: 'creature-1', teamSlot: 1 })],
  });
  killTheWild(state, content);
  const events = resolveCorpse(state, content);
  expect(state.device?.quantity).toBe(0);
  expect(state.wilds.length).toBe(0);
  expect(state.team.length).toBe(1);
  expect(state.ledger.drops).toEqual([{ itemId: 'ember', name: 'Ember', quantity: 1 }]);
  const capture = readCapture(events);
  expect(capture?.success).toBe(false);
  expect(capture?.potential).toBeUndefined();
  expect(state.spawns[0]?.respawnAt).toBe(START + CORPSE_LINGER_MS + 5000);
}

function theHuntWithoutADeviceRollsTheLoot(): void {
  const content = captureContent(1);
  const state = buildState({
    content,
    team: [buildTeamMember({ creatureId: 'creature-1', teamSlot: 1 })],
  });
  killTheWild(state, content);
  const events = resolveCorpse(state, content);
  expect(state.device).toBeNull();
  expect(state.ledger.drops).toEqual([{ itemId: 'ember', name: 'Ember', quantity: 1 }]);
  expect(readCapture(events)).toBeUndefined();
  expect(state.wilds.length).toBe(0);
}

function theFullTeamSendsTheCaptureToTheStorage(): void {
  const content = captureContent(1);
  const team = [];
  for (let slot = 1; slot <= 5; slot += 1) {
    team.push(buildTeamMember({ creatureId: `creature-${slot}`, teamSlot: slot }));
  }
  const state = buildState({ content, device: { ...DEVICE }, team });
  killTheWild(state, content);
  const events = resolveCorpse(state, content);
  expect(state.team.length).toBe(5);
  const capture = readCapture(events);
  expect(capture?.success).toBe(true);
  expect(capture?.teamSlot).toBeUndefined();
  expect(state.ledger.drops).toEqual([]);
}

test('the experience levels the creature', theExperienceLevelsTheCreature);
test(
  'the capture consumes the device and adds the creature',
  theCaptureConsumesTheDeviceAndAddsTheCreature,
);
test('the failed capture loots and respawns', theFailedCaptureLootsAndRespawns);
test('the hunt without a device rolls the loot', theHuntWithoutADeviceRollsTheLoot);
test('the full team sends the capture to the storage', theFullTeamSendsTheCaptureToTheStorage);
