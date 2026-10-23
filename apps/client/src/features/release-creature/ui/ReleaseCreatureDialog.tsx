import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Button } from '~/shared/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/shared/ui/dialog';
import { Text } from '~/shared/ui/text';

const TITLE = 'Soltar criatura?';
const CANCEL_LABEL = 'Cancelar';
const CONFIRM_LABEL = 'Soltar';

export type ReleaseCreatureDialogProps = {
  contained?: boolean;
  creatureName: string;
  isOpen: boolean;
  isReleasing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * A confirmacao da liberacao de uma criatura.
 *
 * Soltar uma criatura e o mesmo que deletar um treinador: a acao nao tem
 * volta. O dialogo avisa com a frase que importa — a criatura some do
 * armazenamento para sempre — e o botao destrutivo fecha a decisao.
 */
export function ReleaseCreatureDialog(props: ReleaseCreatureDialogProps): ReactElement {
  const {
    contained = false,
    creatureName,
    isOpen,
    isReleasing = false,
    onCancel,
    onConfirm,
  } = props;

  function handleClose(): void {
    if (isReleasing) {
      return;
    }
    onCancel();
  }

  return (
    <Dialog contained={contained} isOpen={isOpen} onClose={handleClose}>
      <DialogHeader>{TITLE}</DialogHeader>
      <DialogBody>
        <Text color="fg.muted" variant="body">
          Atenção, essa ação não pode ser desfeita! Soltar{' '}
          <Text as="span" color="fg" variant="label">
            {creatureName}
          </Text>{' '}
          tira a criatura do seu armazenamento e ela não volta nunca mais.
        </Text>
      </DialogBody>
      <DialogFooter>
        <Box display="flex" gap="2" justifyContent="flex-end" width="full">
          <Button disabled={isReleasing} tone="secondary" onClick={onCancel}>
            {CANCEL_LABEL}
          </Button>
          <Button tone="danger" loading={isReleasing} onClick={onConfirm}>
            {CONFIRM_LABEL}
          </Button>
        </Box>
      </DialogFooter>
    </Dialog>
  );
}
