/* eslint-disable oxsome/no-inline-structural-types */
import { Dialog } from '@chakra-ui/react';

import type { HuntingLocationWaveRange } from './types';
import { WaveRangesForm } from './WaveRangesForm';

type WaveRangeList = Array<HuntingLocationWaveRange>;
type CloseHandler = () => void;
type SaveHandler = (ranges: WaveRangeList) => void;

export interface WaveRangesModalProps {
  onClose: CloseHandler;
  onSave: SaveHandler;
  open: boolean;
  waveRanges: WaveRangeList;
}

export function WaveRangesModal(props: WaveRangesModalProps): React.ReactElement {
  const { onClose, onSave, open, waveRanges } = props;

  function handleOpenChange(): void {
    onClose();
  }

  const formElement = open ? (
    <WaveRangesForm initialWaveRanges={waveRanges} onClose={onClose} onSave={onSave} />
  ) : null;

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open} size="lg">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg="gray.900" color="white" p="6">
          <Dialog.Header>
            <Dialog.Title fontSize="lg" fontWeight="bold">
              Configurar Faixas de Ondas (Wave Ranges)
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>{formElement}</Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
