import './game.css';
import * as React from 'react';

import type { CharacterProfile, CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import { GameCanvas } from './GameCanvas';
import { HuntInterface } from './HuntInterface';

export function GamePage(): React.ReactElement {
  const [hunt, setHunt] = React.useState<HuntState | null>(null);
  const [collection, setCollection] = React.useState<CollectionStateEvent['collection'] | null>(
    null,
  );
  const [profile, setProfile] = React.useState<CharacterProfile | null>(null);
  const commandSenderRef = React.useRef<HuntCommandSender | null>(null);
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
  function sendHuntCommand(command: HuntCommand): boolean {
    const sender = commandSenderRef.current;
    return sender ? sender(command) : false;
  }
  return (
    <main className="game-frame">
      <GameCanvas
        onCharacterProfileChange={handleCharacterProfileChange}
        onCollectionChange={handleCollectionChange}
        onHuntCommandSenderChange={handleHuntCommandSenderChange}
        onHuntStateChange={handleHuntStateChange}
      />
      <HuntInterface
        collection={collection}
        hunt={hunt}
        profile={profile}
        sendHuntCommand={sendHuntCommand}
      />
    </main>
  );
}

type HuntCommandSender = (command: HuntCommand) => boolean;
