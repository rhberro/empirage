/* eslint-disable oxsome/no-jsx-inline-computation */
import './game.css';
import * as React from 'react';

import type { HuntCommand } from '../api/hunt-protocol';
import { dispatchOptimisticCommand, gameStore } from '../model/game-store';
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
    dispatchOptimisticCommand(identifiedCommand);
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

function commandWithId(command: HuntCommand): HuntCommand {
  if (command.commandId) {
    return command;
  }
  return { ...command, commandId: globalThis.crypto.randomUUID() };
}

function isPartyManagementCommand(command: HuntCommand): boolean {
  return (
    command.type === 'move_creature_to_party' ||
    command.type === 'move_creature_to_storage' ||
    command.type === 'release_creature' ||
    command.type === 'reorder_party_creature'
  );
}
