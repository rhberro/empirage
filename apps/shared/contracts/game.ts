import type { PlayerState } from './player';
import type { SkillSlot } from './skill';

/**
 * The version of the protocol.
 *
 * The envelope carries it so that a change of protocol is refused with clarity
 * instead of being misread. A client that does not know the version of a
 * message answers with an error instead of guessing.
 */
export const PROTOCOL_VERSION = 1;

/**
 * The codes the game channel can answer with.
 */
export type GameErrorCode =
  | 'invalid_message'
  | 'invalid_command'
  | 'trainer_not_found'
  | 'unauthenticated'
  | 'internal_error';

/**
 * A command of the game, sent by the client over the channel.
 *
 * The commands never change the state by themselves: they are validated and
 * applied by the same rules that advance the simulation.
 */
export type GameCommand =
  | { type: 'finalize_hunt' }
  | { type: 'swap_creature'; creatureId: string }
  | { type: 'use_ability'; slot: SkillSlot }
  | { type: 'use_consumable'; slot: SkillSlot };

/**
 * What the client sends over the channel.
 *
 * Every message carries the version of the protocol and, when it expects an
 * answer, the id of the request that correlates the answer with the command.
 */
export type ClientMessage =
  | { reqId: string; trainerId: string; type: 'select_trainer'; v: number }
  | { command: GameCommand; reqId: string; type: 'command'; v: number }
  | { sentAt: number; type: 'ping'; v: number };

/**
 * What the server sends over the channel.
 */
export type ServerMessage =
  | { code?: GameErrorCode; message: string; type: 'error'; v: number }
  | {
      /** Why the command did not work, when it did not. */
      code?: GameErrorCode;
      ok: boolean;
      reqId: string;
      rev: number;
      type: 'command_result';
      v: number;
    }
  | { sentAt: number; type: 'pong'; v: number }
  | { state: PlayerState; type: 'state_snapshot'; v: number };

/**
 * The request id of a command.
 *
 * The client writes it, the server answers with it, and the client uses it to
 * know which answer belongs to which command.
 */
export type RequestId = string;
