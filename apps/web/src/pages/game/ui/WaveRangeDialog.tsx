/* eslint-disable oxsome/no-inline-functions-objects-arrays, oxsome/no-jsx-inline-computation */
import { AspectRatio, Box, CloseButton, Dialog, For, HStack, Text, VStack } from '@chakra-ui/react';
import * as React from 'react';

import type { HuntingLocation, HuntingLocationWaveRange } from '~/entities/hunting-location';

import type { HuntCommand } from '../api/hunt-protocol';
import { selectHuntingLocationId, useGameStore } from '../model/game-store';
import {
  selectWaveRangeModalState,
  toggleWaveRangeModal,
  useModalStore,
} from '../model/modal-store';
import { useHuntingLocations } from '../model/use-hunting-locations';
import { Slot } from './BottomBar/Slot';

type WaveRangeDialogProps = { onCommand: (command: HuntCommand) => boolean };

export function WaveRangeDialog(props: WaveRangeDialogProps): React.ReactElement | null {
  const { onCommand } = props;
  const open = useModalStore(selectWaveRangeModalState);
  const { data = [] } = useHuntingLocations();
  const huntingLocationId = useGameStore(selectHuntingLocationId);
  // const waveRange = useGameStore(selectHuntWaveRange);
  function findLocation(candidate: HuntingLocation): boolean {
    return candidate.id === huntingLocationId;
  }
  const location = data.find(findLocation);
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
    onCommand(command);
  }
  function renderRange(range: HuntingLocationWaveRange): React.ReactElement {
    const { maximumSize, minimumSize } = range;
    const onClick = selectRange.bind(null, minimumSize, maximumSize);
    const label = minimumSize === maximumSize ? maximumSize : minimumSize + ' - ' + maximumSize;
    return (
      <VStack>
        <Slot content={<Text textStyle="xl">{maximumSize}</Text>} onClick={onClick} />
        <Text>{label}</Text>
      </VStack>
    );
  }
  return (
    <Dialog.Root lazyMount onOpenChange={toggleWaveRangeModal} open={open} unmountOnExit>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger>
            <CloseButton size="md" />
          </Dialog.CloseTrigger>
          <Dialog.Header justifyContent="center">
            <Dialog.Title textStyle="2xl">Configuração de Caçada</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <VStack gap="4">
              <AspectRatio ratio={1} w="full">
                <Box shadow="panel">Preview</Box>
              </AspectRatio>
              <HStack>
                <For each={location.waveRanges}>{renderRange}</For>
              </HStack>
              <Dialog.Description textAlign="center">
                A configuração passa a valer quando a próxima onda começar.
              </Dialog.Description>
            </VStack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
