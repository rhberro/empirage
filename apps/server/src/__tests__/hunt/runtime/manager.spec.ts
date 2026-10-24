import { expect, test } from 'bun:test';

import type { HuntDelta, HuntRuntimeEvent } from '@creatures/contracts/huntSim';

import type { HuntSnapshotWire } from '~/hunt/runtime/wire';

import { findRow } from './fakeHuntAdmin';
import type { FakeWrite } from './fakeQuery';
import type { Harness } from './managerSupport';
import {
  addStorageCreature,
  buildHarness,
  CREATURE_ID,
  EMBER_ID,
  expectStartError,
  readCreatureHp,
  seedCreatureHp,
  START,
  startHunt,
  TRAINER_ID,
} from './managerSupport';

function startsTheHunt(): Promise<void> {
  const harness = buildHarness();
  return startHunt(harness).then(function assert(snapshot: HuntSnapshotWire): void {
    expect(snapshot.session.id).toBe('session-1');
    expect(snapshot.session.status).toBe('active');
    expect(snapshot.player.id).toBe(CREATURE_ID);
    expect(snapshot.wilds?.length).toBeGreaterThan(0);
    expect(harness.manager.has(TRAINER_ID)).toBe(true);
    expect(findRow(harness.db, 'hunt_sessions', 'id', 'session-1')).toBeDefined();
    const insert = harness.db.writes.find(function isSessionInsert(write: FakeWrite): boolean {
      return write.table === 'hunt_sessions' && write.operation === 'insert';
    });
    expect(insert).toBeDefined();
    expect(Array.isArray(harness.deltas)).toBe(true);
  });
}

function refusesASecondHunt(): Promise<void> {
  const harness = buildHarness();
  return startHunt(harness).then(function secondStart(): Promise<void> {
    return expectStartError(startHunt(harness), 'already_hunting');
  });
}

function refusesWithoutStamina(): Promise<void> {
  const harness = buildHarness({ trainerStamina: 10 });
  return expectStartError(startHunt(harness), 'stamina_insufficient');
}

function refusesBelowTheMinimumLevel(): Promise<void> {
  const harness = buildHarness({ minimumLevel: 50 });
  return expectStartError(startHunt(harness), 'level_too_low');
}

function checkpointsAfterTwoSeconds(): Promise<void> {
  const harness = buildHarness();
  return startHunt(harness)
    .then(function advance(): Promise<void> {
      harness.advanceClock(3000);
      return harness.manager.advanceAll();
    })
    .then(function assert(): void {
      const checkpoint = findCheckpoint(harness, START + 3000);
      expect(checkpoint).toBeDefined();
      const payload = checkpoint?.payload as Record<string, unknown>;
      expect(payload.simulation_state).toBeDefined();
      expect(payload.rng_seed).toBeDefined();
      expect(payload.rng_draws).toBeDefined();
      const teamWrite = harness.db.writes.find(function isTeamWrite(write: FakeWrite): boolean {
        return write.table === 'creatures' && write.operation === 'update';
      });
      expect(teamWrite).toBeDefined();
    });
}

function creditsTheLootOnce(): Promise<void> {
  const harness = buildHarness();
  return startHunt(harness).then(function firstAdvance(): Promise<void> {
    return advanceToLoot(harness).then(function afterLoot(): Promise<void> {
      return harness.manager.snapshot(TRAINER_ID).then(function assert(
        snapshot: HuntSnapshotWire | null,
      ): Promise<void> {
        expect(snapshot).not.toBeNull();
        const quantity = readEmberQuantity(harness);
        expect(quantity).toBeGreaterThan(0);
        expect(quantity).toBe(readLedgerEmber(snapshot));
        harness.advanceClock(3000);
        return harness.manager.advanceAll().then(function afterAll(): Promise<void> {
          return harness.manager.snapshot(TRAINER_ID).then(function assertAfter(
            after: HuntSnapshotWire | null,
          ): void {
            expect(readEmberQuantity(harness)).toBe(readLedgerEmber(after));
          });
        });
      });
    });
  });
}

/**
 * Runs the hunt until the first loot is credited.
 *
 * The map and the spawns are content: a change to either moves the first kill,
 * so the test waits for the fact it verifies instead of hardcoding the second.
 */
function advanceToLoot(harness: Harness): Promise<void> {
  return advanceToLootTick(harness, 0);
}

function advanceToLootTick(harness: Harness, tick: number): Promise<void> {
  if (tick >= 120) {
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- the caller awaits a promise.
    return Promise.reject(new Error('the hunt did not loot in two minutes'));
  }
  harness.advanceClock(1000);
  return harness.manager.advance(TRAINER_ID).then(function afterAdvance(): Promise<void> | void {
    if (harness.deltas.some(hasLoot)) {
      return;
    }
    if (!harness.manager.has(TRAINER_ID)) {
      throw new Error('the hunt ended before the first loot');
    }
    return advanceToLootTick(harness, tick + 1);
  });
}

function hasLoot(delta: HuntDelta): boolean {
  return delta.events.some(isLoot);
}

function finalizesTheHunt(): Promise<void> {
  const harness = buildHarness();
  seedCreatureHp(harness, CREATURE_ID, 3);
  addStorageCreature(harness, 'creature-2', 1);
  return startHunt(harness)
    .then(function finalize(): Promise<void> {
      harness.advanceClock(1000);
      return harness.manager.finalize(TRAINER_ID);
    })
    .then(function closeAgain(): Promise<void> {
      return harness.manager.close(TRAINER_ID, 'player_finalized');
    })
    .then(function assert(): void {
      expect(harness.manager.has(TRAINER_ID)).toBe(false);
      expect(harness.ended.length).toBe(1);
      expect(harness.ended[0]?.reason).toBe('player_finalized');
      expect(readCreatureHp(harness, CREATURE_ID)).toBeNull();
      expect(readCreatureHp(harness, 'creature-2')).toBeNull();
      const session = findRow(harness.db, 'hunt_sessions', 'id', 'session-1');
      expect(session?.status).toBe('finished');
      expect(session?.end_reason).toBe('player_finalized');
      const trainer = findRow(harness.db, 'trainers', 'id', TRAINER_ID);
      expect(trainer?.stamina_minutes).toBe(480);
    });
}

function findCheckpoint(harness: Harness, at: number): { payload: unknown } | undefined {
  return harness.db.writes.find(function isCheckpoint(write: FakeWrite): boolean {
    const payload = write.payload as Record<string, unknown> | null;
    return (
      write.table === 'hunt_sessions' &&
      write.operation === 'update' &&
      payload?.last_simulated_at === new Date(at).toISOString()
    );
  });
}

function isLoot(event: HuntRuntimeEvent): boolean {
  return event.type === 'loot';
}

function readEmberQuantity(harness: Harness): number {
  const row = findRow(harness.db, 'trainer_items', 'item_id', EMBER_ID);
  return typeof row?.quantity === 'number' ? row.quantity : 0;
}

function readLedgerEmber(snapshot: HuntSnapshotWire | null): number {
  if (snapshot === null) {
    return 0;
  }
  const drop = snapshot.ledger.drops.find(function isEmber(item): boolean {
    return item.itemId === EMBER_ID;
  });
  return drop?.quantity ?? 0;
}

test('starts the hunt', startsTheHunt);
test('refuses a second hunt', refusesASecondHunt);
test('refuses without stamina', refusesWithoutStamina);
test('refuses below the minimum level', refusesBelowTheMinimumLevel);
test('checkpoints after two seconds', checkpointsAfterTwoSeconds);
test('credits the loot once', creditsTheLootOnce);
test('finalizes the hunt', finalizesTheHunt);
