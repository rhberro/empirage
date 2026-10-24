import type { SkillSlot } from '@creatures/contracts/skill';

import {
  deleteTrainerGearSlot,
  findItemCategory,
  writeTrainerGearSlot,
} from '~/db/loadoutRepository';
import type { GearSlotKind } from '~/db/loadoutRepository';
import type { ServerDependencies } from '~/dependencies';
import { logRouteEvent } from '~/logging/routeLog';
import { defineRoute, isResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import {
  invalidCommandResponse,
  readJsonBody,
  readSessionTrainer,
  refreshHuntLoadout,
  unauthenticatedResponse,
  writeOutcomeResponse,
} from '~/routes/loadoutSupport';
import { composeProtectedRoute } from '~/routes/routeChain';
import {
  DEVICE_SLOT,
  isTrainerGearSlot,
  readGearSlotNumber,
  validateGearSlot,
} from '~/validation/loadout';
import type { GearSlotCommand } from '~/validation/loadout';

const GEAR_SLOT_PATH = '/api/gear-slots/:slot';

type GearStep<T> = Response | T;

export function createGearSlotRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute('PUT', GEAR_SLOT_PATH, composeProtectedRoute(deps, handleWriteGearSlot(deps))),
    defineRoute('DELETE', GEAR_SLOT_PATH, composeProtectedRoute(deps, handleDeleteGearSlot(deps))),
  ];
}

/**
 * Puts an item in one of the three slots that belong to the trainer: the two
 * consumable slots and the device slot.
 *
 * The command answers with no content and pushes the new state to the channel
 * of the account.
 */
function handleWriteGearSlot(deps: ServerDependencies): RouteHandler {
  return function writeGearSlot(
    req: Request,
    params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = readSessionTrainer(deps, userId);
    if (isResponse(trainerId)) {
      return Promise.resolve(trainerId);
    }
    const slot = readGearSlotNumber(params.slot);
    if (slot === null || !isTrainerGearSlot(slot)) {
      return Promise.resolve(invalidCommandResponse());
    }
    return readJsonBody(req)
      .then(readGearCommand)
      .then(function withCommand(command: GearStep<GearSlotCommand>): Response | Promise<Response> {
        if (isResponse(command)) {
          return command;
        }
        const kind = readGearKind(slot);
        if (!matchesTrigger(kind, command)) {
          return invalidCommandResponse();
        }
        return writeGearSlotOfKind(deps, ctx, userId, trainerId, slot, kind, command);
      });
  };
}

/**
 * Writes the item in the slot, after checking that the category of the item is
 * the one of the slot.
 */
function writeGearSlotOfKind(
  deps: ServerDependencies,
  ctx: RequestContext,
  userId: string,
  trainerId: string,
  slot: number,
  kind: GearSlotKind,
  command: GearSlotCommand,
): Promise<Response> {
  return findItemCategory(deps.admin, command.itemId).then(function withCategory(
    category: string | null,
  ): Response | Promise<Response> {
    if (category !== kind) {
      return invalidCommandResponse();
    }
    return writeTrainerGearSlot(deps.admin, {
      itemId: command.itemId,
      kind,
      slot: slot as SkillSlot,
      trainerId,
      triggerHpPercent: kind === 'device' ? null : (command.triggerHpPercent ?? null),
    }).then(function afterWrite(error: { code: string; message: string } | null): Response {
      const response = writeOutcomeResponse(deps, userId, trainerId, error);
      if (error === null) {
        logRouteEvent(deps.logger, ctx, 'gear slot written', { itemId: command.itemId, slot });
        refreshHuntLoadout(deps, userId);
      }
      return response;
    });
  });
}

/**
 * Empties one of the three slots that belong to the trainer.
 *
 * The command answers with no content and pushes the new state to the channel
 * of the account.
 */
function handleDeleteGearSlot(deps: ServerDependencies): RouteHandler {
  return function deleteGearSlot(
    _req: Request,
    params: Record<string, string>,
    ctx: RequestContext,
  ): Promise<Response> {
    const userId = ctx.userId;
    if (userId === null) {
      return Promise.resolve(unauthenticatedResponse());
    }
    const trainerId = readSessionTrainer(deps, userId);
    if (isResponse(trainerId)) {
      return Promise.resolve(trainerId);
    }
    const slot = readGearSlotNumber(params.slot);
    if (slot === null || !isTrainerGearSlot(slot)) {
      return Promise.resolve(invalidCommandResponse());
    }
    return deleteTrainerGearSlot(deps.admin, trainerId, slot as SkillSlot).then(
      function afterDelete(error: { code: string; message: string } | null): Response {
        const response = writeOutcomeResponse(deps, userId, trainerId, error);
        if (error === null) {
          logRouteEvent(deps.logger, ctx, 'gear slot cleared', { slot });
          refreshHuntLoadout(deps, userId);
        }
        return response;
      },
    );
  };
}

/**
 * The consumable slots have a life trigger and the device slot has none.
 */
function matchesTrigger(kind: GearSlotKind, command: GearSlotCommand): boolean {
  if (kind === 'device') {
    return command.triggerHpPercent === undefined;
  }
  return command.triggerHpPercent !== undefined;
}

function readGearKind(slot: number): GearSlotKind {
  return slot === DEVICE_SLOT ? 'device' : 'consumable';
}

function readGearCommand(body: unknown): GearStep<GearSlotCommand> {
  const validation = validateGearSlot(body);
  if (!validation.ok) {
    return invalidCommandResponse();
  }
  return validation.value;
}
