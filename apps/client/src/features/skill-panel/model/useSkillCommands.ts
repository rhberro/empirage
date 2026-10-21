import type { PlayerState } from '@creatures/contracts/player';

import { awaitStateAfterCommand, readAppliedRevision } from '~/entities/team';
import { createApiDeps } from '~/shared/api';
import type { SkillCommandResult, TrainerClientErrorCode } from '~/shared/api';
import { requestClearGear, requestEquipAbilities, requestEquipGear } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

import { clampTrigger } from './skillPanelCommands';
import { dispatchCommand } from './skillPanelDispatcher';
import type { PendingCommand } from './skillPanelQueue';
import { hasCommand } from './skillPanelQueue';
import { skillPanelStore } from './skillPanelStore';

export type SkillCommandsOptions = {
  /** Called when the server refuses a command of the panel. */
  onCommandFailed: (code: TrainerClientErrorCode) => void;
  state: PlayerState | null;
};

export type SkillCommandsView = {
  equipAbility: (command: PendingCommand, abilityIds: string[]) => void;
  equipConsumable: (
    command: PendingCommand,
    itemId: string,
    triggerHpPercent: number,
    clear: boolean,
  ) => void;
  equipDevice: (command: PendingCommand, itemId: string, clear: boolean) => void;
  setTrigger: (command: PendingCommand, itemId: string, percent: number) => void;
};

/**
 * The commands of the skill bar.
 *
 * The server is the authority: the command goes out, and the state of the
 * player comes back by the channel of the game. Nothing is decided here — the
 * panel applies the change locally and waits for the state that confirms it.
 *
 * The commands go out one at a time: the second one leaves only after the
 * first one lands, so the server applies them in the order the player made
 * them and the loadout of the second one is built over the state the first
 * one left.
 */
export function useSkillCommands(options: SkillCommandsOptions): SkillCommandsView {
  const { onCommandFailed, state } = options;
  return {
    equipAbility: buildAbilityCommand(state, onCommandFailed),
    equipConsumable: buildConsumableCommand(state, onCommandFailed),
    equipDevice: buildDeviceCommand(onCommandFailed),
    setTrigger: buildTriggerCommand(onCommandFailed),
  };
}

/**
 * The command that puts an ability in a slot of the active creature.
 */
function buildAbilityCommand(
  state: PlayerState | null,
  onCommandFailed: (code: TrainerClientErrorCode) => void,
): (command: PendingCommand, abilityIds: string[]) => void {
  return function equipAbility(command: PendingCommand, abilityIds: string[]): void {
    send(
      command,
      function buildAbilityRequest(): Promise<SkillCommandResult> | null {
        if (state === null) {
          return null;
        }
        const creatureId = state.activeCreatureId;
        if (creatureId === null) {
          return null;
        }
        return requestEquipAbilities(createApiDeps(getAccessToken), creatureId, abilityIds);
      },
      onCommandFailed,
    );
  };
}

/**
 * The command that puts a consumable in a slot, or that empties it.
 *
 * The consumable that is already in the slot is the one that empties it: the
 * player clicks the item again to clear the slot.
 */
function buildConsumableCommand(
  state: PlayerState | null,
  onCommandFailed: (code: TrainerClientErrorCode) => void,
): (command: PendingCommand, itemId: string, triggerHpPercent: number, clear: boolean) => void {
  return function equipConsumable(
    command: PendingCommand,
    itemId: string,
    triggerHpPercent: number,
    clear: boolean,
  ): void {
    send(
      command,
      function buildConsumableRequest(): Promise<SkillCommandResult> | null {
        if (state === null) {
          return null;
        }
        if (clear) {
          return requestClearGear(createApiDeps(getAccessToken), command.slot);
        }
        return requestEquipGear(
          createApiDeps(getAccessToken),
          command.slot,
          itemId,
          triggerHpPercent,
        );
      },
      onCommandFailed,
    );
  };
}

/**
 * The command that puts the capture device in its slot, or that empties it.
 */
function buildDeviceCommand(
  onCommandFailed: (code: TrainerClientErrorCode) => void,
): (command: PendingCommand, itemId: string, clear: boolean) => void {
  return function equipDevice(command: PendingCommand, itemId: string, clear: boolean): void {
    send(
      command,
      function buildDeviceRequest(): Promise<SkillCommandResult> | null {
        if (clear) {
          return requestClearGear(createApiDeps(getAccessToken), command.slot);
        }
        return requestEquipGear(createApiDeps(getAccessToken), command.slot, itemId);
      },
      onCommandFailed,
    );
  };
}

/**
 * The command that moves the life that triggers the consumable of the slot.
 */
function buildTriggerCommand(
  onCommandFailed: (code: TrainerClientErrorCode) => void,
): (command: PendingCommand, itemId: string, percent: number) => void {
  return function setTrigger(command: PendingCommand, itemId: string, percent: number): void {
    send(
      command,
      function buildTriggerRequest(): Promise<SkillCommandResult> | null {
        const clamped = clampTrigger(percent);
        return requestEquipGear(createApiDeps(getAccessToken), command.slot, itemId, clamped);
      },
      onCommandFailed,
    );
  };
}

/**
 * Sends a command, in the turn of the ones that are already on their way.
 *
 * A command that is not in the queue anymore does not go out: the player
 * left the screen, or the server refused the command it was built over.
 */
function send(
  command: PendingCommand,
  build: () => Promise<SkillCommandResult> | null,
  onCommandFailed: (code: TrainerClientErrorCode) => void,
): void {
  dispatchCommand(function runCommand(): Promise<void> {
    if (!hasCommand(skillPanelStore.getState().commands, command.id)) {
      return Promise.resolve();
    }
    // The revision the client has is the one the command is built on: the
    // state that confirms the command is the one that is newer than it.
    const expectedRev = readAppliedRevision();
    const request = build();
    if (request === null) {
      skillPanelStore.getState().removeCommand(command.id);
      return Promise.resolve();
    }
    return request.then(handleAccepted(expectedRev), handleRefused(command, onCommandFailed));
  });
}

/**
 * The server accepted the command: the client waits for the state that
 * confirms it, and asks for the state when it does not come.
 */
function handleAccepted(expectedRev: number): () => void {
  return function onAccepted(): void {
    void awaitStateAfterCommand(expectedRev);
  };
}

/**
 * The server refused the command: the change the client applied is undone.
 */
function handleRefused(
  command: PendingCommand,
  onCommandFailed: (code: TrainerClientErrorCode) => void,
): (code: TrainerClientErrorCode) => void {
  return function onRefused(code: TrainerClientErrorCode): void {
    skillPanelStore.getState().removeCommand(command.id);
    onCommandFailed(code);
  };
}
