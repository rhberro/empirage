/* eslint-disable oxsome/no-jsx-inline-computation */
import './game.css';
import * as React from 'react';

import type { CharacterProfile, CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import {
  optimisticCollectionConfiguration,
  optimisticHuntConfiguration,
} from '../model/optimistic-configuration';
import { useHuntingLocations } from '../model/use-hunting-locations';
import { GameCanvas } from './GameCanvas';
import { HuntInterface } from './HuntInterface';
import { TransitionLoadingScreen } from './TransitionLoadingScreen';

export function GamePage(): React.ReactElement {
  const [hunt, setHunt] = React.useState<HuntState | null>(null);
  const [collection, setCollection] = React.useState<CollectionStateEvent['collection'] | null>(
    null,
  );
  const [profile, setProfile] = React.useState<CharacterProfile | null>(null);
  const [gameReady, setGameReady] = React.useState(false);
  const [transitionMessage, setTransitionMessage] = React.useState<string | null>('Conectando…');
  const commandSenderRef = React.useRef<HuntCommandSender | null>(null);
  const huntingLocations = useHuntingLocations();
  function handleHuntStateChange(nextHunt: HuntState | null): void {
    setHunt(nextHunt);
  }
  function handleCollectionChange(nextCollection: CollectionStateEvent['collection']): void {
    setCollection(nextCollection);
  }
  function handleCharacterProfileChange(nextProfile: CharacterProfile): void {
    setProfile(nextProfile);
  }
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
    if (!sender || !sender(command)) {
      return false;
    }
    const updateCollection = collectionUpdater(command);
    const updateHunt = huntUpdater(command);
    setCollection(updateCollection);
    setHunt(updateHunt);
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
    return current ? optimisticCollectionConfiguration(current, command) : current;
  };
}

function huntUpdater(command: HuntCommand): HuntUpdater {
  return function updateHunt(current: Hunt): Hunt {
    return current ? optimisticHuntConfiguration(current, command) : current;
  };
}
