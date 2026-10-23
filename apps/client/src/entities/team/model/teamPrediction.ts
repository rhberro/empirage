import type { Creature } from '@creatures/contracts/creature';
import type { TeamSlot } from '@creatures/contracts/player';

import { MAX_TEAM_SIZE } from './team.constants';
import type { TeamCommand, TeamRoster } from './team.types';
import { readTeamSlots } from './teamRoster';

/**
 * The team the client shows while the command is on its way to the server.
 *
 * The change is predicted from the team the client already has — the team of
 * the server plus the changes that are still on their way — and never from a
 * truth of its own. The functions are pure: the same team and the same
 * command always give the same team, which is what makes them testable.
 */
export function applyCommands(roster: TeamRoster, commands: TeamCommand[]): TeamRoster {
  let current = roster;
  for (const command of commands) {
    current = applyCommand(current, command);
  }
  return current;
}

/**
 * The team with the change of one command.
 */
export function applyCommand(roster: TeamRoster, command: TeamCommand): TeamRoster {
  if (command.kind === 'add') {
    return predictAdd(roster, command.creatureId);
  }
  if (command.kind === 'remove') {
    return predictRemove(roster, command.creatureId);
  }
  if (command.kind === 'release') {
    return predictRelease(roster, command.creatureId);
  }
  return predictReorder(roster, command.order);
}

/**
 * Whether the team of the server already carries the change of the command.
 *
 * The state the server pushes is the truth: when the team it carries has the
 * change, the command is confirmed and the prediction has nothing left to say.
 */
export function satisfiesCommand(roster: TeamRoster, command: TeamCommand): boolean {
  if (command.kind === 'add') {
    return findTeamSlot(roster.team, command.creatureId) !== null;
  }
  if (command.kind === 'remove') {
    return findTeamSlot(roster.team, command.creatureId) === null;
  }
  if (command.kind === 'release') {
    return findStorageCreature(roster.storage, command.creatureId) === null;
  }
  return readOrder(roster.team, command.order) === command.order.join(',');
}

/**
 * The team with a creature that enters it.
 *
 * The creature takes the first free slot, the same slot the database gives
 * it. A creature that is not in the storage, or a team that is full, leaves
 * the team as it is: the server refuses the command, and the client shows the
 * refusal instead of a change that never happens.
 */
function predictAdd(roster: TeamRoster, creatureId: string): TeamRoster {
  const creature = findStorageCreature(roster.storage, creatureId);
  if (creature === null) {
    return roster;
  }
  const slot = readFreeSlot(roster.team);
  if (slot === null) {
    return roster;
  }
  const inTeam: TeamSlot = {
    creature: { ...creature, isInTeam: true, teamSlot: slot },
    slot,
  };
  return {
    storage: roster.storage.filter(function keepOther(entry: Creature): boolean {
      return entry.id !== creatureId;
    }),
    team: readTeamSlots([...roster.team, inTeam]),
  };
}

/**
 * The team without a creature, which goes back to the storage.
 */
function predictRemove(roster: TeamRoster, creatureId: string): TeamRoster {
  const slot = findTeamSlot(roster.team, creatureId);
  if (slot === null) {
    return roster;
  }
  const creature: Creature = { ...slot.creature, isInTeam: false, teamSlot: null };
  return {
    storage: insertStorageCreature(roster.storage, creature),
    team: roster.team.filter(function keepOther(entry: TeamSlot): boolean {
      return entry.creature.id !== creatureId;
    }),
  };
}

/**
 * The team without a creature that the player released.
 *
 * A criatura solta deixa o armazenamento para sempre: ela nao volta para o
 * time nem para a grade.
 */
function predictRelease(roster: TeamRoster, creatureId: string): TeamRoster {
  return {
    storage: roster.storage.filter(function keepOther(creature: Creature): boolean {
      return creature.id !== creatureId;
    }),
    team: roster.team,
  };
}

/**
 * The team in the order the player asked for.
 *
 * The slots are given again, from the first one: the creature in the field is
 * the one in the first slot. A creature that is not in the order keeps its
 * place at the end of the team.
 */
function predictReorder(roster: TeamRoster, order: string[]): TeamRoster {
  const remaining = [...roster.team];
  const ordered: TeamSlot[] = [];
  for (const creatureId of order) {
    const entry = takeTeamSlot(remaining, creatureId);
    if (entry === null) {
      continue;
    }
    ordered.push({ creature: entry.creature, slot: ordered.length + 1 });
  }
  for (const entry of remaining) {
    ordered.push({ creature: entry.creature, slot: ordered.length + 1 });
  }
  return { storage: roster.storage, team: ordered };
}

/**
 * The first slot of the team that no creature occupies.
 */
function readFreeSlot(team: TeamSlot[]): number | null {
  for (let slot = 1; slot <= MAX_TEAM_SIZE; slot += 1) {
    const taken = team.some(function occupies(entry: TeamSlot): boolean {
      return entry.slot === slot;
    });
    if (!taken) {
      return slot;
    }
  }
  return null;
}

/**
 * The creature goes back to the storage where the capture puts it: the most
 * recent capture first.
 */
function insertStorageCreature(storage: Creature[], creature: Creature): Creature[] {
  const entries = [...storage, creature];
  // The client targets es2022, where `toSorted` is not in the standard library.
  // oxlint-disable-next-line unicorn/no-array-sort
  return entries.sort(function byCapture(left: Creature, right: Creature): number {
    return readCapturedAt(right).localeCompare(readCapturedAt(left));
  });
}

function readCapturedAt(creature: Creature): string {
  return creature.capturedAt ?? '';
}

function findStorageCreature(storage: Creature[], creatureId: string): Creature | null {
  const found = storage.find(function matches(creature: Creature): boolean {
    return creature.id === creatureId;
  });
  return found ?? null;
}

function findTeamSlot(team: TeamSlot[], creatureId: string): TeamSlot | null {
  const found = team.find(function matches(entry: TeamSlot): boolean {
    return entry.creature.id === creatureId;
  });
  return found ?? null;
}

function takeTeamSlot(team: TeamSlot[], creatureId: string): TeamSlot | null {
  const index = team.findIndex(function matches(entry: TeamSlot): boolean {
    return entry.creature.id === creatureId;
  });
  if (index < 0) {
    return null;
  }
  const [entry] = team.splice(index, 1);
  return entry;
}

/**
 * The order of the team, restricted to the creatures of the order the player
 * asked for.
 */
function readOrder(team: TeamSlot[], order: string[]): string {
  const ids = team
    .filter(function inOrder(entry: TeamSlot): boolean {
      return order.includes(entry.creature.id);
    })
    .map(function readId(entry: TeamSlot): string {
      return entry.creature.id;
    });
  return ids.join(',');
}
