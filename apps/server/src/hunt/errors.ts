import { HUNT_MINIMUM_STAMINA_MINUTES } from '~/hunt/rules';

/**
 * Why a hunt could not begin.
 *
 * The route layer maps the code to a response, so the reason never travels as
 * a message the client has to parse.
 */
export type HuntStartErrorCode =
  | 'already_hunting'
  | 'area_not_found'
  | 'level_too_low'
  | 'stamina_insufficient'
  | 'no_viable_creature';

const DEFAULT_MESSAGES: Record<HuntStartErrorCode, string> = {
  already_hunting: 'The trainer already has an open hunt',
  area_not_found: 'The hunt area was not found',
  level_too_low: 'The trainer level is below the minimum of the area',
  no_viable_creature: 'The team has no creature able to fight',
  stamina_insufficient: `A hunt needs at least ${HUNT_MINIMUM_STAMINA_MINUTES} minutes of stamina`,
};

/**
 * The refusal of the start of a hunt.
 */
export class HuntStartError extends Error {
  public readonly code: HuntStartErrorCode;

  public constructor(code: HuntStartErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.code = code;
    this.name = 'HuntStartError';
  }
}
