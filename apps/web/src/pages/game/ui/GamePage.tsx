import './game.css';
import { Show } from '@chakra-ui/react';
import * as React from 'react';

import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import { GameCanvas } from './GameCanvas';
import { HuntInterface } from './HuntInterface';

export function GamePage(): React.ReactElement {
  const [hunt, setHunt] = React.useState<HuntState | null>(null);
  const commandSenderRef = React.useRef<HuntCommandSender | null>(null);
  function handleHuntStateChange(nextHunt: HuntState | null): void {
    setHunt(nextHunt);
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
  function renderHuntInterface(state: HuntState): React.ReactElement {
    return <HuntInterface hunt={state} sendHuntCommand={sendHuntCommand} />;
  }
  return (
    <main className="game-frame">
      <GameCanvas
        onHuntCommandSenderChange={handleHuntCommandSenderChange}
        onHuntStateChange={handleHuntStateChange}
      />
      <Show when={hunt}>{renderHuntInterface}</Show>
    </main>
  );
}

type HuntCommandSender = (command: HuntCommand) => boolean;
