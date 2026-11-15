/* eslint-disable oxsome/no-jsx-inline-computation */
import './game.css';
import * as React from 'react';

import type { CharacterProfile, CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
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
    setTransitionMessage(active ? message : null);
  }
  function sendHuntCommand(command: HuntCommand): boolean {
    const sender = commandSenderRef.current;
    return sender ? sender(command) : false;
  }
  return (
    <main className="game-frame">
      <GameCanvas
        huntingLocations={huntingLocations.data ?? []}
        onCharacterProfileChange={handleCharacterProfileChange}
        onCollectionChange={handleCollectionChange}
        onHuntCommandSenderChange={handleHuntCommandSenderChange}
        onHuntStateChange={handleHuntStateChange}
        onTransitionChange={handleTransitionChange}
      />
      <HuntInterface
        collection={collection}
        hunt={hunt}
        locations={huntingLocations.data ?? []}
        profile={profile}
        sendHuntCommand={sendHuntCommand}
      />
      {transitionMessage ? <TransitionLoadingScreen message={transitionMessage} /> : null}
    </main>
  );
}

type HuntCommandSender = (command: HuntCommand) => boolean;
