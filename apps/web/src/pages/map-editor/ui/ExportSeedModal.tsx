/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, Dialog, HStack, Textarea } from '@chakra-ui/react';
import { useState } from 'react';

type CloseHandler = () => void;

export interface ExportSeedModalProps {
  onClose: CloseHandler;
  open: boolean;
  sql: string;
}

export function ExportSeedModal(props: ExportSeedModalProps): React.ReactElement {
  const { onClose, open, sql } = props;
  const [copied, setCopied] = useState<boolean>(false);

  function handleOpenChange(): void {
    setCopied(false);
    onClose();
  }

  function resetCopied(): void {
    setCopied(false);
  }

  async function handleCopy(): Promise<void> {
    try {
      if (globalThis.navigator !== undefined && globalThis.navigator.clipboard) {
        await globalThis.navigator.clipboard.writeText(sql);
        setCopied(true);
        globalThis.setTimeout(resetCopied, 2000);
      }
    } catch {
      // ignore clipboard error
    }
  }

  const copyLabel = copied ? 'Copiado!' : 'Copiar SQL';

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg="gray.900" color="white" maxW="4xl" p="6">
          <Dialog.Header>
            <Dialog.Title fontSize="lg" fontWeight="bold">
              Exportar para SEED SQL
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Box mb="4">
              <Textarea
                bg="gray.950"
                borderColor="gray.700"
                fontFamily="monospace"
                fontSize="xs"
                h="400px"
                readOnly
                value={sql}
              />
            </Box>
            <HStack justify="flex-end" spaceX="3">
              <Button colorPalette="blue" onClick={handleCopy} size="sm">
                {copyLabel}
              </Button>
              <Button onClick={onClose} size="sm" variant="subtle">
                Fechar
              </Button>
            </HStack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
