import { Button, Dialog, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';

type ReleaseConfirmationDialogProps = {
  creature: CollectionCreature | null;
  onCancel: () => void;
  onConfirm: () => void;
};

type OpenChangeDetails = { open: boolean };

export function ReleaseConfirmationDialog(
  props: ReleaseConfirmationDialogProps,
): React.ReactElement | null {
  const { creature, onCancel, onConfirm } = props;
  const open = creature !== null;

  function handleOpenChange(details: OpenChangeDetails): void {
    if (!details.open) {
      onCancel();
    }
  }

  if (!creature) {
    return null;
  }

  const description = `Tem certeza que deseja soltar ${creature.species.name} (Nv. ${creature.level})? Esta ação não pode ser desfeita.`;

  return (
    <Dialog.Root lazyMount onOpenChange={handleOpenChange} open={open} role="alertdialog">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Soltar criatura</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Text>{description}</Text>
          </Dialog.Body>
          <Dialog.Footer>
            <Button onClick={onCancel} variant="outline">
              Cancelar
            </Button>
            <Button colorPalette="red" onClick={onConfirm}>
              Soltar
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
