/* eslint-disable oxsome/no-jsx-inline-computation */
import './game.css';
import * as React from 'react';

import type { CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import { gameStore, selectCollection } from '../model/game-store';
import {
  optimisticCollectionConfiguration,
  optimisticHuntConfiguration,
} from '../model/optimistic-configuration';
import { optimisticPartyState } from '../model/optimistic-party';
import { useHuntingLocations } from '../model/use-hunting-locations';
import { GameCanvas } from './GameCanvas';
import { HuntInterface } from './HuntInterface';
import { TransitionLoadingScreen } from './TransitionLoadingScreen';

export function GamePage(): React.ReactElement {
  const [gameReady, setGameReady] = React.useState(false);
  const [transitionMessage, setTransitionMessage] = React.useState<string | null>('Conectando…');
  const commandSenderRef = React.useRef<HuntCommandSender | null>(null);
  const huntingLocations = useHuntingLocations();
  function handleHuntCommandSenderChange(sender: HuntCommandSender | undefined): void {
    if (sender) {
      commandSenderRef.current = sender;
    }
  }
  function handleTransitionChange(active: boolean, message: string): void {
    if (active) {
      setTransitionMessage(message);
      return;
    }
    if (gameReady) {
      setTransitionMessage(null);
    }
  }
  function handleGameReady(): void {
    setGameReady(true);
    setTransitionMessage(null);
  }
  function sendHuntCommand(command: HuntCommand): boolean {
    const current = gameStore.getState();
    if (current.hunt && isPartyManagementCommand(command)) {
      return false;
    }
    const sender = commandSenderRef.current;
    const identifiedCommand = commandWithId(command);
    if (!sender || !sender(identifiedCommand)) {
      return false;
    }
    const updateCollection = collectionUpdater(identifiedCommand);
    const updateHunt = huntUpdater(identifiedCommand);
    current.setCollection(updateCollection(selectCollection(current)));
    current.setHunt(updateHunt(current.hunt));
    return true;
  }
  return (
    <main className="game-frame">
      <GameCanvas
        huntingLocations={huntingLocations.data ?? []}
        onHuntCommandSenderChange={handleHuntCommandSenderChange}
        onGameReady={handleGameReady}
        onTransitionChange={handleTransitionChange}
      />
      {gameReady && !transitionMessage ? <HuntInterface sendHuntCommand={sendHuntCommand} /> : null}
      {transitionMessage ? <TransitionLoadingScreen message={transitionMessage} /> : null}
    </main>
  );
}

type HuntCommandSender = (command: HuntCommand) => boolean;
type Collection = CollectionStateEvent['collection'] | null;
type Hunt = HuntState | null;
type CollectionUpdater = (current: Collection) => Collection;
type HuntUpdater = (current: Hunt) => Hunt;

function collectionUpdater(command: HuntCommand): CollectionUpdater {
  return function updateCollection(current: Collection): Collection {
    if (!current) {
      return current;
    }
    const configured = optimisticCollectionConfiguration(current, command);
    return optimisticPartyState(configured, command);
  };
}

function huntUpdater(command: HuntCommand): HuntUpdater {
  return function updateHunt(current: Hunt): Hunt {
    return current ? optimisticHuntConfiguration(current, command) : current;
  };
}

function commandWithId(command: HuntCommand): HuntCommand {
  if (!isConfigurationCommand(command) || command.commandId) {
    return command;
  }
  return { ...command, commandId: globalThis.crypto.randomUUID() };
}

function isConfigurationCommand(command: HuntCommand): boolean {
  return (
    command.type === 'configure_ability' ||
    command.type === 'configure_capture' ||
    command.type === 'configure_healing_item' ||
    command.type === 'configure_wave_range'
  );
}

function isPartyManagementCommand(command: HuntCommand): boolean {
  return (
    command.type === 'move_creature_to_party' ||
    command.type === 'move_creature_to_storage' ||
    command.type === 'release_creature' ||
    command.type === 'reorder_party_creature'
  );
}
