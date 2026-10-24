import type { HuntSnapshot } from '@creatures/contracts/huntSim';

import type { HuntManager } from '~/hunt/runtime/types';

/**
 * A snapshot of a hunt with the least content a reader needs.
 */
export function buildHuntSnapshot(huntRev = 4): HuntSnapshot {
  return {
    abilities: [],
    consumables: [],
    device: null,
    huntRev,
    ledger: { drops: [], encounters: 0, experience: 0, kills: 0, spent: [] },
    player: {
      dir: 'down',
      hp: 20,
      id: 'creature-1',
      kind: 'player',
      level: 1,
      maxHp: 20,
      speciesName: 'Brasa',
      speciesSlug: 'brasa',
      tile: { x: 1, y: 1 },
    },
    serverNow: 1000,
    session: {
      areaName: 'Campina Cinzenta',
      areaSlug: 'campina-cinzenta',
      endsAt: 2000,
      id: 'session-1',
      startedAt: 1000,
      status: 'active',
    },
    team: [],
    trainer: { dir: 'down', tile: { x: 2, y: 2 } },
    waves: [],
    wilds: [],
  };
}

const NOOP_MANAGER: HuntManager = {
  advance: function advance(): Promise<null> {
    return Promise.resolve(null);
  },
  advanceAll: function advanceAll(): Promise<void> {
    return Promise.resolve();
  },
  close: function close(): Promise<void> {
    return Promise.resolve();
  },
  finalize: function finalize(): Promise<void> {
    return Promise.resolve();
  },
  has: function has(): boolean {
    return false;
  },
  hydrate: function hydrate(): Promise<void> {
    return Promise.resolve();
  },
  refreshLoadout: function refreshLoadout(): Promise<void> {
    return Promise.resolve();
  },
  snapshot: function snapshot(): Promise<null> {
    return Promise.resolve(null);
  },
  start: function start(): Promise<never> {
    return Promise.reject(new Error('the hunt manager of the test does not start hunts'));
  },
  stop: function stop(): void {
    return undefined;
  },
  swap: function swap(): Promise<boolean> {
    return Promise.resolve(false);
  },
  sweep: function sweep(): Promise<void> {
    return Promise.resolve();
  },
};

/**
 * A manager of hunts that does nothing, for the tests that never run a hunt.
 *
 * A test that needs one operation to answer differently overrides only that
 * operation, keeping the rest inert.
 */
export function buildNoopHuntManager(overrides?: Partial<HuntManager>): HuntManager {
  return { ...NOOP_MANAGER, ...overrides };
}
