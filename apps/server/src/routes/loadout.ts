import {
  findCreatureSpeciesId,
  listSpeciesAbilityIds,
  writeCreatureAbilitySlots,
} from '~/db/loadoutRepository';
import type { ServerDependencies } from '~/dependencies';
import { logRouteEvent } from '~/logging/routeLog';
import { defineRoute, isResponse } from '~/router';
import type { RequestContext, Route, RouteHandler } from '~/router';
import {
  creatureNotFoundResponse,
  invalidCommandResponse,
  readJsonBody,
  readSessionTrainer,
  refreshHuntLoadout,
  unauthenticatedResponse,
  writeOutcomeResponse,
} from '~/routes/loadoutSupport';
import { composeProtectedRoute } from '~/routes/routeChain';
import { validateAbilitySlots } from '~/validation/loadout';
import type { AbilitySlotsCommand } from '~/validation/loadout';
import { isUuid } from '~/validation/trainer';

const CREATURE_ABILITY_SLOTS_PATH = '/api/creatures/:id/ability-slots';

type LoadoutStep<T> = Response | T;

export function createLoadoutRoutes(deps: ServerDependencies): Route[] {
  return [
    defineRoute(
      'PUT',
      CREATURE_ABILITY_SLOTS_PATH,
      composeProtectedRoute(deps, handleWriteAbilitySlots(deps)),
    ),
  ];
}

/**
 * Writes the abilities equipped in the four ability slots of a creature.
 *
 * The list is the loadout in the order of the slots: the first entry is the
 * first slot, and an empty entry is an empty slot.
 *
 * The command answers with no content and pushes the new state to the channel
 * of the account.
 */
function handleWriteAbilitySlots(deps: ServerDependencies): RouteHandler {
  return function writeAbilitySlots(
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
    const creatureId = params.id;
    if (creatureId === undefined || !isUuid(creatureId)) {
      return Promise.resolve(creatureNotFoundResponse());
    }
    return readJsonBody(req)
      .then(readAbilityCommand)
      .then(function withCommand(
        command: LoadoutStep<AbilitySlotsCommand>,
      ): Response | Promise<Response> {
        if (isResponse(command)) {
          return command;
        }
        return writeAbilitySlotsOfCreature(deps, ctx, userId, trainerId, creatureId, command);
      });
  };
}

/**
 * Writes the loadout of a creature, after checking that every ability of the
 * loadout belongs to the species of the creature.
 */
function writeAbilitySlotsOfCreature(
  deps: ServerDependencies,
  ctx: RequestContext,
  userId: string,
  trainerId: string,
  creatureId: string,
  command: AbilitySlotsCommand,
): Promise<Response> {
  return findCreatureSpeciesId(deps.admin, trainerId, creatureId).then(function withSpecies(
    speciesId: string | null,
  ): Response | Promise<Response> {
    if (speciesId === null) {
      return creatureNotFoundResponse();
    }
    return listSpeciesAbilityIds(deps.admin, speciesId).then(function withAbilities(
      allowedIds: string[],
    ): Response | Promise<Response> {
      if (!isAllowedAbility(allowedIds, command.abilityIds)) {
        return invalidCommandResponse();
      }
      return writeCreatureAbilitySlots(deps.admin, creatureId, userId, command.abilityIds).then(
        function afterWrite(error: { code: string; message: string } | null): Response {
          const response = writeOutcomeResponse(deps, userId, trainerId, error);
          if (error === null) {
            logRouteEvent(deps.logger, ctx, 'ability slots written', {
              creatureId,
              slotCount: command.abilityIds.length,
            });
            refreshHuntLoadout(deps, userId);
          }
          return response;
        },
      );
    });
  });
}

/**
 * Every ability of the loadout belongs to the species of the creature.
 */
function isAllowedAbility(allowedIds: string[], abilityIds: (string | null)[]): boolean {
  const allowed = new Set(allowedIds);
  return abilityIds.every(function isAllowed(abilityId: string | null): boolean {
    if (abilityId === null) {
      return true;
    }
    return allowed.has(abilityId);
  });
}

function readAbilityCommand(body: unknown): LoadoutStep<AbilitySlotsCommand> {
  const validation = validateAbilitySlots(body);
  if (!validation.ok) {
    return invalidCommandResponse();
  }
  return validation.value;
}
