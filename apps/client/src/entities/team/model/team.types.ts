import type { Creature } from '@creatures/contracts/creature';
import type { InventoryItem } from '@creatures/contracts/inventory';
import type { TeamSlot } from '@creatures/contracts/player';

/**
 * The codes a team command or the player-state read can answer with.
 *
 * The team endpoints reuse the trainer error namespace, so the codes are the
 * same strings the rest of the client already knows.
 */
export type TeamErrorCode =
  | 'creature_not_found'
  | 'invalid_team_command'
  | 'team_full'
  | 'trainer_not_found'
  | 'unauthenticated'
  | 'unknown';

export type TeamCommandResult = { ok: true } | { ok: false; code: TeamErrorCode };

/**
 * The part of the state that a team command changes.
 *
 * The team and the storage are two sides of the same coin: a creature is
 * either in the team or stored away.
 */
export type TeamRoster = {
  storage: Creature[];
  team: TeamSlot[];
};

/**
 * A change of the team that is on its way to the server.
 *
 * The change is relative: it is applied to the team the client has, so a
 * command that comes after another one is predicted on top of the first.
 */
export type TeamCommand =
  | { creatureId: string; kind: 'add' }
  | { creatureId: string; kind: 'release' }
  | { creatureId: string; kind: 'remove' }
  | { kind: 'reorder'; order: string[] };

/**
 * The slice of the player state the team screen reads.
 *
 * The team and the storage are two sides of the same coin — a creature is
 * either in the team or stored away — and both change with a team command, so
 * they live in one snapshot. The backpack travels in the same snapshot because
 * the player state is read once.
 */
export type TeamSnapshot = {
  activeCreatureId: string | null;
  backpack: InventoryItem[];
  error: TeamErrorCode | null;
  isLoading: boolean;
  storage: Creature[];
  team: TeamSlot[];
};

/**
 * What a screen reads from the team.
 *
 * The snapshot carries the error code, because the code is the fact; the view
 * carries the message, because the interface only shows text. The team of the
 * view is the team of the server with the changes the client predicts, so the
 * screen shows the change in the same instant of the click.
 */
export type TeamView = {
  activeCreatureId: string | null;
  backpack: InventoryItem[];
  error: string | null;
  isLoading: boolean;
  storage: Creature[];
  team: TeamSlot[];
  addToTeam(creatureId: string): Promise<void>;
  /** Releases a creature: it leaves the storage for good. */
  releaseCreature(creatureId: string): Promise<void>;
  removeFromTeam(creatureId: string): Promise<void>;
  reorderTeam(order: string[]): Promise<void>;
};
