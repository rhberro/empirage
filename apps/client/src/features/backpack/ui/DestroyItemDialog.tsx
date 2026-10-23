import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Button } from '~/shared/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/shared/ui/dialog';
import { Text } from '~/shared/ui/text';

const TITLE = 'Destruir item';
const CANCEL_LABEL = 'Cancelar';
const CONFIRM_LABEL = 'Destruir';

export type DestroyItemDialogProps = {
  contained?: boolean;
  error?: string | null;
  isOpen: boolean;
  isDestroying?: boolean;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * A confirmacao da destruicao de um item.
 *
 * Destruir um item e o mesmo que soltar uma criatura: a acao nao tem volta.
 * O dialogo avisa com a frase que importa — o item some da mochila para
 * sempre — e o botao destrutivo fecha a decisao. Quando o comando falha, o
 * dialogo fica aberto e a mensagem mora no corpo dele: o jogador le o que
 * deu errado e tenta de novo sem reabrir nada.
 */
// eslint-disable-next-line max-lines-per-function
export function DestroyItemDialog(props: DestroyItemDialogProps): ReactElement {
  const {
    contained = false,
    error = null,
    isOpen,
    isDestroying = false,
    itemName,
    onCancel,
    onConfirm,
  } = props;

  function handleClose(): void {
    if (isDestroying) {
      return;
    }
    onCancel();
  }

  const errorNode =
    error === null ? null : (
      <Text color="fg.error" variant="meta">
        {error}
      </Text>
    );

  return (
    <Dialog contained={contained} isOpen={isOpen} onClose={handleClose}>
      <DialogHeader>{TITLE}</DialogHeader>
      <DialogBody>
        <Text color="fg.muted" variant="body">
          O item{' '}
          <Text as="span" color="fg" variant="label">
            {itemName}
          </Text>{' '}
          é destruído para sempre.
        </Text>
        {errorNode}
      </DialogBody>
      <DialogFooter>
        <Box display="flex" gap="2" justifyContent="flex-end" width="full">
          <Button disabled={isDestroying} tone="secondary" onClick={onCancel}>
            {CANCEL_LABEL}
          </Button>
          <Button tone="danger" loading={isDestroying} onClick={onConfirm}>
            {CONFIRM_LABEL}
          </Button>
        </Box>
      </DialogFooter>
    </Dialog>
  );
}
