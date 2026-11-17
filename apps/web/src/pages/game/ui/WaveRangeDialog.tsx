/* eslint-disable oxsome/no-inline-functions-objects-arrays, oxsome/no-jsx-inline-computation */
import { Badge, Button, Dialog, HStack, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { HuntCommand } from '../api/hunt-protocol';
import type { HuntingLocation } from '../api/hunting-locations';
import {
  selectHuntWaveRange,
  selectHuntingLocationId,
  selectIsHunting,
  useGameStore,
} from '../model/game-store';
import {
  selectWaveRangeModalState,
  toggleWaveRangeModal,
  useModalStore,
} from '../model/modal-store';

type WaveRangeDialogProps = {
  locations: Array<HuntingLocation>;
  onCommand: (command: HuntCommand) => boolean;
};

function closeDialog(): void {
  toggleWaveRangeModal();
}

export function WaveRangeDialog(props: WaveRangeDialogProps): React.ReactElement | null {
  const { locations, onCommand } = props;
  const isHunting = useGameStore(selectIsHunting);
  const huntingLocationId = useGameStore(selectHuntingLocationId);
  const waveRange = useGameStore(selectHuntWaveRange);
  const open = useModalStore(selectWaveRangeModalState);
  if (!isHunting || !huntingLocationId || !waveRange) {
    return null;
  }
  const location = locations.find(function findLocation(candidate): boolean {
    return candidate.id === huntingLocationId;
  });
  if (!location) {
    return null;
  }
  function selectRange(minimumSize: number, maximumSize: number): void {
    const command: HuntCommand = {
      type: 'configure_wave_range',
      version: 1,
      waveRangeMaximumSize: maximumSize,
      waveRangeMinimumSize: minimumSize,
    };
    if (onCommand(command)) {
      toggleWaveRangeModal();
    }
  }
  return (
    <Dialog.Root lazyMount onOpenChange={closeDialog} open={open} unmountOnExit>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text color="brand.solid" fontSize="xs" fontWeight="bold" letterSpacing="widest">
              PRÓXIMA ONDA
            </Text>
            <Dialog.Title>Quantidade de criaturas</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="3">
              <Text color="fg.muted" fontSize="sm">
                A escolha passa a valer quando a próxima onda começar.
              </Text>
              {location.waveRanges.map(function renderRange(range): React.ReactElement {
                const selected =
                  waveRange.minimumSize === range.minimumSize &&
                  waveRange.maximumSize === range.maximumSize;
                const onClick = selectRange.bind(null, range.minimumSize, range.maximumSize);
                return (
                  <Button
                    aria-pressed={selected}
                    justifyContent="space-between"
                    key={`${range.minimumSize}-${range.maximumSize}`}
                    onClick={onClick}
                    variant={selected ? 'solid' : 'outline'}
                  >
                    <span>
                      {range.minimumSize}–{range.maximumSize} criaturas
                    </span>
                    {selected ? <Badge>Selecionada</Badge> : null}
                  </Button>
                );
              })}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack justify="end" w="full">
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Fechar</Button>
              </Dialog.ActionTrigger>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
