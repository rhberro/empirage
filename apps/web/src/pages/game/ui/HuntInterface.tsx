/* eslint-disable import/max-dependencies, react/no-multi-comp, react/set-state-in-effect, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types, oxsome/no-jsx-inline-computation */
import { Button, HStack } from '@chakra-ui/react';
import * as React from 'react';

import { Icon } from '~/shared/ui/Icon';

import type { HuntCommand } from '../api/hunt-protocol';
import { selectIsHunting, useGameStore } from '../model/game-store';
import { toggleHuntingLocationsModal, toggleStorageModal } from '../model/modal-store';
import { BottomBar } from './BottomBar';
import { CreatureStorageDialog } from './CreatureStorageDialog';
import { HuntControls } from './HuntControls';
import { HuntingLocationsDialog } from './HuntingLocationsDialog';
import { HuntStatusPanels } from './HuntStatusPanels';
import { HuntWaveCountdown } from './HuntWaveCountdown';
import { WaveRangeDialog } from './WaveRangeDialog';

type HuntInterfaceProps = {
  sendHuntCommand: (command: HuntCommand) => boolean;
};
type LeaveHuntButtonProps = { onCommand: (command: HuntCommand) => boolean };

export function HuntInterface(props: HuntInterfaceProps): React.ReactElement {
  const { sendHuntCommand } = props;
  return (
    <>
      <HuntStatusPanels onCommand={sendHuntCommand} />
      <HuntNavigation onCommand={sendHuntCommand} />
      <BottomBar />
      <HuntWaveCountdown />
      <CreatureStorageDialog onCommand={sendHuntCommand} />
      <HuntingLocationsDialog onStart={startHunt.bind(null, sendHuntCommand)} />
      <WaveRangeDialog onCommand={sendHuntCommand} />
      <HuntControls onCommand={sendHuntCommand} />
    </>
  );
}

function HuntNavigation(props: LeaveHuntButtonProps): React.ReactElement {
  const { onCommand } = props;
  const isHunting = useGameStore(selectIsHunting);
  const secondaryAction = isHunting ? (
    <LeaveHuntButton onCommand={onCommand} />
  ) : (
    <Button aria-label="Abrir locais de caça" onClick={toggleHuntingLocationsModal}>
      <Icon name="explore" />
      Locais de caça
    </Button>
  );
  return (
    <HStack left="50%" position="fixed" top="3" transform="translateX(-50%)" zIndex="2">
      <Button aria-label="Abrir armazenamento" onClick={toggleStorageModal}>
        <Icon name="inventory_2" />
        Armazenamento
      </Button>
      {secondaryAction}
    </HStack>
  );
}

function LeaveHuntButton(props: LeaveHuntButtonProps): React.ReactElement {
  const { onCommand } = props;
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const [deadline, setDeadline] = React.useState<number | null>(null);
  const onCommandRef = React.useRef(onCommand);
  const completedRef = React.useRef(false);

  React.useEffect(
    function synchronizeCommandSender(): void {
      onCommandRef.current = onCommand;
    },
    [onCommand],
  );

  function beginLeave(): void {
    if (countdown === null) {
      completedRef.current = false;
      setCountdown(5);
      setDeadline(Date.now() + 5_000);
    }
  }

  React.useEffect(
    function advanceCountdown(): (() => void) | undefined {
      if (deadline === null) {
        return;
      }
      function updateCountdown(): void {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
        setCountdown(remaining);
        if (remaining === 0 && !completedRef.current) {
          completedRef.current = true;
          onCommandRef.current({ type: 'leave_hunt', version: 1 });
          setDeadline(null);
          setCountdown(null);
        }
      }
      updateCountdown();
      const timer = globalThis.setInterval(updateCountdown, 100);
      function clearCountdown(): void {
        globalThis.clearInterval(timer);
      }
      return clearCountdown;
    },
    [deadline],
  );
  return (
    <Button aria-label="Sair da caça" disabled={countdown !== null} onClick={beginLeave}>
      <Icon name="logout" />
      {countdown === null ? 'Sair da caça' : `Saindo em ${countdown}`}
    </Button>
  );
}

function startHunt(
  sendHuntCommand: (command: HuntCommand) => boolean,
  huntingLocationId: number,
): boolean {
  const command: HuntCommand = { huntingLocationId, type: 'start_hunt', version: 1 };
  return sendHuntCommand(command);
}
