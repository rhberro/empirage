/* eslint-disable oxsome/no-inline-structural-types */
import { Dialog } from '@chakra-ui/react';

import type { HuntingLocationAnimation } from '~/entities/hunting-location';

import { AnimationManagerForm } from './AnimationManagerForm';

type AnimationList = Array<HuntingLocationAnimation>;
type CloseHandler = () => void;
type SaveHandler = (animations: AnimationList) => void;

interface AnimationManagerModalProps {
  animations: AnimationList;
  onClose: CloseHandler;
  onSave: SaveHandler;
  open: boolean;
}

export function AnimationManagerModal(props: AnimationManagerModalProps): React.ReactElement {
  const { animations, onClose, onSave, open } = props;

  function handleOpenChange(): void {
    onClose();
  }

  const formElement = open ? (
    <AnimationManagerForm animations={animations} onClose={onClose} onSave={onSave} />
  ) : null;

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open} size="lg">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg="gray.900" color="white" p="6">
          <Dialog.Header>
            <Dialog.Title fontSize="lg" fontWeight="bold">
              Gerenciador de Animações de Tiles
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>{formElement}</Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
