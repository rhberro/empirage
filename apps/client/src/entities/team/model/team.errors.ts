import type { TeamErrorCode } from './team.types';

const TEAM_ERROR_CODES: readonly string[] = [
  'creature_not_found',
  'invalid_team_command',
  'last_creature',
  'last_team_member',
  'team_full',
  'trainer_not_found',
  'unauthenticated',
];

/**
 * Whether a code the player state answered with belongs to the team.
 *
 * The player-state read shares the trainer error namespace, which carries
 * codes a team command never answers with. The team only knows its own, and
 * anything else is an unknown failure.
 */
export function isTeamErrorCode(value: string): value is TeamErrorCode {
  return TEAM_ERROR_CODES.includes(value);
}
