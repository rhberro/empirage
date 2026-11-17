/* eslint-disable oxsome/no-jsx-inline-computation */
import './game.css';
import * as React from 'react';

import type { CharacterProfile, CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import {
  gameStore,
  selectCollection,
  selectHunt,
  selectProfile,
  useGameStore,
} from '../model/game-store';
import {
  optimisticCollectionConfiguration,
  optimisticHuntConfiguration,
} from '../model/optimistic-configuration';
import { optimisticPartyState } from '../model/optimistic-party';
import { useHuntingLocations } from '../model/use-hunting-locations';
import { GameCanvas } from './GameCanvas';
import { HuntInterface } from './HuntInterface';
import { TransitionLoadingScreen } from './TransitionLoadingScreen';

function handleHuntStateChange(_nextHunt: HuntState | null): void {
  // GameSession applies authoritative events before Phaser receives them.
}

function handleCollectionChange(_nextCollection: CollectionStateEvent['collection']): void {
  // GameSession applies authoritative events before Phaser receives them.
}

function handleCharacterProfileChange(_nextProfile: CharacterProfile): void {
  // GameSession applies authoritative events before Phaser receives them.
}

export function GamePage(): React.ReactElement {
  const collection = useGameStore(selectCollection);
  const hunt = useGameStore(selectHunt);
  const profile = useGameStore(selectProfile);
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
    const sender = commandSenderRef.current;
    const identifiedCommand = commandWithId(command);
    if (!sender || !sender(identifiedCommand)) {
      return false;
    }
    const updateCollection = collectionUpdater(identifiedCommand);
    const updateHunt = huntUpdater(identifiedCommand);
    const current = gameStore.getState();
    current.setCollection(updateCollection(current.collection));
    current.setHunt(updateHunt(current.hunt));
    return true;
  }
  return (
    <main className="game-frame">
      <GameCanvas
        huntingLocations={huntingLocations.data ?? []}
        onCharacterProfileChange={handleCharacterProfileChange}
        onCollectionChange={handleCollectionChange}
        onHuntCommandSenderChange={handleHuntCommandSenderChange}
        onHuntStateChange={handleHuntStateChange}
        onGameReady={handleGameReady}
        onTransitionChange={handleTransitionChange}
      />
      {gameReady && !transitionMessage ? (
        <HuntInterface
          collection={collection}
          hunt={hunt}
          locations={huntingLocations.data ?? []}
          profile={profile}
          sendHuntCommand={sendHuntCommand}
        />
      ) : null}
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
