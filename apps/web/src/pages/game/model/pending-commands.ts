import type { CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import {
  optimisticCollectionConfiguration,
  optimisticHuntConfiguration,
} from './optimistic-configuration';
import { optimisticPartyState } from './optimistic-party';

type Collection = CollectionStateEvent['collection'] | null;
type Hunt = HuntState | null;

export type PendingCommand = {
  command: HuntCommand;
  commandId: string;
  createdAt: number;
};

const COMMAND_EXPIRATION_MS = 5_000;

function isMatchingCommand(commandId: string) {
  return function matches(item: PendingCommand): boolean {
    return item.commandId === commandId;
  };
}

function isRecentCommand(cutoff: number) {
  return function isRecent(item: PendingCommand): boolean {
    return item.createdAt >= cutoff;
  };
}

type PendingCommands = Array<PendingCommand>;

export class PendingCommandQueue {
  private commands: PendingCommands = [];

  public add(command: HuntCommand): void {
    if (!command.commandId) {
      return;
    }
    const pending: PendingCommand = {
      command,
      commandId: command.commandId,
      createdAt: Date.now(),
    };
    this.commands.push(pending);
  }

  public acknowledge(commandId: string | undefined): boolean {
    if (!commandId) {
      return false;
    }
    const matcher = isMatchingCommand(commandId);
    const index = this.commands.findIndex(matcher);
    if (index === -1) {
      return false;
    }
    this.commands = this.commands.slice(index + 1);
    return true;
  }

  public evictExpired(maxAgeMs = COMMAND_EXPIRATION_MS): boolean {
    const cutoff = Date.now() - maxAgeMs;
    const initialLength = this.commands.length;
    const recentPredicate = isRecentCommand(cutoff);
    this.commands = this.commands.filter(recentPredicate);
    return this.commands.length !== initialLength;
  }

  public clear(): void {
    this.commands = [];
  }

  public hasPending(): boolean {
    return this.commands.length > 0;
  }

  public replayOnCollection(baseCollection: Collection): Collection {
    if (!baseCollection || this.commands.length === 0) {
      return baseCollection;
    }
    let current = baseCollection;
    for (const item of this.commands) {
      const configured = optimisticCollectionConfiguration(current, item.command);
      current = optimisticPartyState(configured, item.command);
    }
    return current;
  }

  public replayOnHunt(baseHunt: Hunt): Hunt {
    if (!baseHunt || this.commands.length === 0) {
      return baseHunt;
    }
    let current = baseHunt;
    for (const item of this.commands) {
      current = optimisticHuntConfiguration(current, item.command);
    }
    return current;
  }
}
