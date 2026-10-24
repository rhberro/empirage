import type { HuntDelta, HuntEndedMessage, HuntSnapshot } from './huntSim';
import type { PlayerState } from './player';
import type { SkillSlot } from './skill';
import type { ActorMedia, PathSegment, Tile } from './world';

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
  | 'internal_error'
  | 'invalid_target'
  | 'tile_blocked';

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
  | { type: 'use_consumable'; slot: SkillSlot }
  | { type: 'move'; target: Tile };

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
  | {
      sentAt: number;
      /** The server clock when the pong was written, for the client clock. */
      serverNow: number;
      type: 'pong';
      v: number;
    }
  | { state: PlayerState; type: 'state_snapshot'; v: number }
  | {
      /** The dynamic part of the world around the observer, sent after the snapshot. */
      actors: ActorMedia[];
      /** The revision of the world the observer receives, monotonic per observer. */
      worldRev: number;
      type: 'world_state';
      /** The one actor the connection belongs to. */
      you: ActorMedia;
      v: number;
    }
  | {
      code?: GameErrorCode;
      ok: boolean;
      /**
       * The full walk, the confirmed tile included as its first from-to.
       */
      path: PathSegment[];
      reqId: string;
      worldRev: number;
      type: 'move_result';
      v: number;
    }
  | {
      actor: ActorMedia;
      worldRev: number;
      type: 'actor_update';
      v: number;
    }
  | {
      actorId: string;
      worldRev: number;
      type: 'actor_leave';
      v: number;
    }
  | (HuntSnapshot & {
      type: 'hunt_state';
      v: number;
    })
  | (HuntDelta & {
      /** What changed in the hunt since the previous message. */
      type: 'hunt_delta';
      v: number;
    })
  | (HuntEndedMessage & { type: 'hunt_ended'; v: number });

/**
 * The request id of a command.
 *
 * The client writes it, the server answers with it, and the client uses it to
 * know which answer belongs to which command.
 */
export type RequestId = string;
