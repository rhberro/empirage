import { expect, test } from 'bun:test';

import type { Creature } from '@creatures/contracts/creature';
import type { PlayerState, TeamSlot } from '@creatures/contracts/player';

import { buildPlayerStateFixture, FIXTURE_REV } from '~/entities/team/model/playerStateFixture';
import type { TeamCommand } from '~/entities/team/model/team.types';
import { applyCommands } from '~/entities/team/model/teamPrediction';
import { readRoster } from '~/entities/team/model/teamRoster';
import { createTeamStore } from '~/entities/team/model/teamStore';
import type { TeamStore } from '~/entities/team/model/teamStore';

const BRASA_ID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const GOTA_ID = 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const MUSGUIM_ID = 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f';

function buildCreature(id: string, options: { isInTeam?: boolean; slot?: number } = {}): Creature {
  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    experience: 0,
    id,
    isInTeam: options.isInTeam ?? false,
    level: 3,
    nickname: null,
    potential: {
      magicAttack: 1,
      magicDefense: 1,
      physicalAttack: 1,
      physicalDefense: 1,
      vitality: 1,
    },
    species: {
      baseMagicAttack: 4,
      baseMagicDefense: 2,
      basePhysicalAttack: 8,
      basePhysicalDefense: 7,
      baseVitality: 22,
      element: 'fire',
      id: 'brasa',
      name: 'Brasa',
      slug: 'brasa',
    },
    speciesId: 'brasa',
    teamSlot: options.slot ?? null,
    trainerId: 'trainer-1',
  };
}

function buildSlot(id: string, slot: number): TeamSlot {
  return { creature: buildCreature(id, { isInTeam: true, slot }), slot };
}

function buildState(): PlayerState {
  return buildPlayerStateFixture({
    activeCreatureId: BRASA_ID,
    storage: [buildCreature(MUSGUIM_ID)],
    team: [buildSlot(BRASA_ID, 1), buildSlot(GOTA_ID, 2)],
  });
}

function readTeam(store: TeamStore): string[] {
  const state = store.getState();
  const roster = applyCommands(readRoster(state.state), state.commands);
  return roster.team.map(function readId(entry: TeamSlot): string {
    return entry.creature.id;
  });
}

test('the change of a command shows before the server answers', function predictsCommand(): void {
  const store = createTeamStore();
  store.getState().applyRestState(buildState());
  const command: TeamCommand = { creatureId: MUSGUIM_ID, kind: 'add' };
  store.getState().addCommand(command);
  expect(readTeam(store)).toEqual([BRASA_ID, GOTA_ID, MUSGUIM_ID]);
});

test('the state the server pushes confirms the change', function confirmsCommand(): void {
  const store = createTeamStore();
  store.getState().applyRestState(buildState());
  store.getState().addCommand({ creatureId: MUSGUIM_ID, kind: 'add' });
  const pushed = buildState();
  pushed.rev = FIXTURE_REV + 1;
  pushed.team = [...pushed.team, buildSlot(MUSGUIM_ID, 3)];
  pushed.storage = [];
  store.getState().applyPushedState(pushed);
  expect(store.getState().commands.length).toBe(0);
  expect(readTeam(store)).toEqual([BRASA_ID, GOTA_ID, MUSGUIM_ID]);
});

test('the change stays on the screen until the server carries it', function keepsPrediction(): void {
  const store = createTeamStore();
  store.getState().applyRestState(buildState());
  store.getState().addCommand({ creatureId: MUSGUIM_ID, kind: 'add' });
  const pushed = buildState();
  pushed.rev = FIXTURE_REV + 1;
  store.getState().applyPushedState(pushed);
  expect(store.getState().commands.length).toBe(1);
  expect(readTeam(store)).toEqual([BRASA_ID, GOTA_ID, MUSGUIM_ID]);
});

/**
 * A state that is not newer than the one the client has is ignored: a push
 * that arrives late does not put the client back in the past.
 */
test('the state that is not newer is ignored', function ignoresOldState(): void {
  const store = createTeamStore();
  store.getState().applyRestState(buildState());
  const older = buildState();
  older.rev = FIXTURE_REV - 1;
  store.getState().applyPushedState(older);
  expect(store.getState().rev).toBe(FIXTURE_REV);
});

/**
 * A server that restarted has a counter that starts over: the state of the
 * new server is taken, even with a revision that is smaller than the one the
 * client had.
 */
test('the state of a server that restarted is taken', function takesResync(): void {
  const store = createTeamStore();
  store.getState().applyRestState(buildState());
  const resynced = buildState();
  resynced.epoch = 'another-epoch';
  resynced.rev = 1;
  store.getState().applyPushedState(resynced);
  expect(store.getState().epoch).toBe('another-epoch');
  expect(store.getState().rev).toBe(1);
});

test('the refusal of the server takes the change back', function revertsCommand(): void {
  const store = createTeamStore();
  store.getState().applyRestState(buildState());
  const command: TeamCommand = { creatureId: MUSGUIM_ID, kind: 'add' };
  store.getState().addCommand(command);
  store.getState().removeCommand(command);
  store.getState().setError('team_full');
  expect(readTeam(store)).toEqual([BRASA_ID, GOTA_ID]);
  expect(store.getState().error).toBe('team_full');
});

test('the read over REST never says that the channel carries the state', function readsOverRest(): void {
  const store = createTeamStore();
  store.getState().applyRestState(buildState());
  expect(store.getState().isPushed).toBe(false);
  expect(store.getState().isLoaded).toBe(true);
});

test('the channel of the game says that the state comes by itself', function readsOverPush(): void {
  const store = createTeamStore();
  store.getState().applyPushedState(buildState());
  expect(store.getState().isPushed).toBe(true);
  expect(store.getState().isLoaded).toBe(true);
});
