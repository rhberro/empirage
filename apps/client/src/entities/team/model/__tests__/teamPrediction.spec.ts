import { expect, test } from 'bun:test';

import type { Creature } from '@creatures/contracts/creature';
import type { TeamSlot } from '@creatures/contracts/player';

import type { TeamCommand, TeamRoster } from '~/entities/team/model/team.types';
import {
  applyCommand,
  applyCommands,
  satisfiesCommand,
} from '~/entities/team/model/teamPrediction';

const BRASA_ID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const GOTA_ID = 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const BROTO_ID = 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f';
const MUSGUIM_ID = 'e4d5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a';

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

function buildRoster(): TeamRoster {
  return {
    storage: [buildCreature(MUSGUIM_ID)],
    team: [buildSlot(BRASA_ID, 1), buildSlot(GOTA_ID, 2)],
  };
}

test('the creature that enters the team takes the first free slot', function predictsAdd(): void {
  const roster = buildRoster();
  const command: TeamCommand = { creatureId: MUSGUIM_ID, kind: 'add' };
  const predicted = applyCommand(roster, command);
  expect(predicted.team.length).toBe(3);
  expect(predicted.team[2].creature.id).toBe(MUSGUIM_ID);
  expect(predicted.team[2].slot).toBe(3);
  expect(predicted.team[2].creature.isInTeam).toBe(true);
  expect(predicted.storage.length).toBe(0);
});

test('the creature that enters the team fills the gap of a free slot', function fillsGap(): void {
  const roster: TeamRoster = {
    storage: [buildCreature(MUSGUIM_ID)],
    team: [buildSlot(BRASA_ID, 1)],
  };
  const command: TeamCommand = { creatureId: MUSGUIM_ID, kind: 'add' };
  const predicted = applyCommand(roster, command);
  expect(predicted.team[1].slot).toBe(2);
  expect(predicted.team[1].creature.id).toBe(MUSGUIM_ID);
});

test('a full team does not change when a creature enters it', function keepsFullTeam(): void {
  const team = [
    buildSlot(BRASA_ID, 1),
    buildSlot(GOTA_ID, 2),
    buildSlot(BROTO_ID, 3),
    buildSlot(MUSGUIM_ID, 4),
    buildSlot('f5e6f7a8-b9c0-4e1f-8a2b-4c5d6e7f8a9b', 5),
  ];
  const roster: TeamRoster = {
    storage: [buildCreature('a5b6c7d8-e9f0-4a2b-9c3d-5e6f7a8b9c0d')],
    team,
  };
  const command: TeamCommand = { creatureId: 'a5b6c7d8-e9f0-4a2b-9c3d-5e6f7a8b9c0d', kind: 'add' };
  expect(applyCommand(roster, command)).toBe(roster);
});

test('a creature that is not in the storage does not enter the team', function keepsRoster(): void {
  const roster = buildRoster();
  const command: TeamCommand = { creatureId: 'unknown-creature', kind: 'add' };
  expect(applyCommand(roster, command)).toBe(roster);
});

test('the creature that leaves the team goes back to the storage', function predictsRemove(): void {
  const roster = buildRoster();
  const command: TeamCommand = { creatureId: BRASA_ID, kind: 'remove' };
  const predicted = applyCommand(roster, command);
  expect(predicted.team.length).toBe(1);
  expect(predicted.team[0].creature.id).toBe(GOTA_ID);
  expect(predicted.storage.length).toBe(2);
  const returned = predicted.storage.find(function find(creature: Creature): boolean {
    return creature.id === BRASA_ID;
  });
  expect(returned?.isInTeam).toBe(false);
  expect(returned?.teamSlot).toBeNull();
});

test('a creature that is not in the team does not leave it', function keepsRoster(): void {
  const roster = buildRoster();
  const command: TeamCommand = { creatureId: MUSGUIM_ID, kind: 'remove' };
  expect(applyCommand(roster, command)).toBe(roster);
});

test('the team takes the order the player asked for', function predictsReorder(): void {
  const roster = buildRoster();
  const command: TeamCommand = { kind: 'reorder', order: [GOTA_ID, BRASA_ID] };
  const predicted = applyCommand(roster, command);
  expect(predicted.team[0].creature.id).toBe(GOTA_ID);
  expect(predicted.team[0].slot).toBe(1);
  expect(predicted.team[1].creature.id).toBe(BRASA_ID);
  expect(predicted.team[1].slot).toBe(2);
});

test('the second change is predicted on top of the first', function stacksCommands(): void {
  const roster = buildRoster();
  const commands: TeamCommand[] = [
    { creatureId: MUSGUIM_ID, kind: 'add' },
    { creatureId: BRASA_ID, kind: 'remove' },
  ];
  const predicted = applyCommands(roster, commands);
  expect(predicted.team.length).toBe(2);
  expect(predicted.team[0].creature.id).toBe(GOTA_ID);
  expect(predicted.team[1].creature.id).toBe(MUSGUIM_ID);
  expect(predicted.storage.length).toBe(1);
});

test('the state of the server confirms a change that already happened', function confirmsAdd(): void {
  const roster = buildRoster();
  const command: TeamCommand = { creatureId: MUSGUIM_ID, kind: 'add' };
  const confirmed = applyCommand(roster, command);
  expect(satisfiesCommand(confirmed, command)).toBe(true);
  expect(satisfiesCommand(roster, command)).toBe(false);
});

test('the state of the server confirms a creature that left the team', function confirmsRemove(): void {
  const roster = buildRoster();
  const command: TeamCommand = { creatureId: BRASA_ID, kind: 'remove' };
  const confirmed = applyCommand(roster, command);
  expect(satisfiesCommand(confirmed, command)).toBe(true);
  expect(satisfiesCommand(roster, command)).toBe(false);
});

test('the state of the server confirms the order of the team', function confirmsReorder(): void {
  const roster = buildRoster();
  const command: TeamCommand = { kind: 'reorder', order: [GOTA_ID, BRASA_ID] };
  const confirmed = applyCommand(roster, command);
  expect(satisfiesCommand(confirmed, command)).toBe(true);
  expect(satisfiesCommand(roster, command)).toBe(false);
});
