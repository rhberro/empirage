import type { PlayerState } from '@creatures/contracts/player';

/**
 * The boot of the server that the fixture comes from.
 */
export const FIXTURE_EPOCH = 'epoch-fixture';

/**
 * The revision of the fixture: the first state the client sees.
 */
export const FIXTURE_REV = 1;

/**
 * The clock of the server in the fixture.
 */
export const FIXTURE_SERVER_NOW = 1767225600000;

/**
 * The state of a player, for the tests.
 *
 * The state carries the revision, the epoch and the clock of the server: the
 * client compares them, and a fixture without them would say nothing about
 * the rules that the comparison decides.
 */
export function buildPlayerStateFixture(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    activeAbilities: [],
    activeCreatureId: null,
    activeVitals: null,
    backpack: [],
    diamonds: 0,
    epoch: FIXTURE_EPOCH,
    equippedAbilities: [],
    equippedConsumables: [],
    equippedDevice: null,
    gold: 0,
    maxStaminaMinutes: 720,
    rev: FIXTURE_REV,
    serverNow: FIXTURE_SERVER_NOW,
    staminaMinutes: 720,
    storage: [],
    team: [],
    trainer: {
      createdAt: '2026-01-01T00:00:00.000Z',
      gender: 'male',
      id: 'trainer-1',
      level: 1,
      name: 'Time de Teste',
      starterSpeciesId: 'species-1',
    },
    ...overrides,
  };
}
