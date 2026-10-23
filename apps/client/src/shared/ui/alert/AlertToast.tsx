import { Box, Toast as ChakraToast } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

import { IconBadge } from '~/shared/ui/badge';

import { AlertClose } from './AlertClose';
import { AlertProgress } from './AlertProgress';
import { alertToaster } from './alertToaster';

type AlertToastProps = {
  toast: {
    duration?: number;
    id?: string;
    meta?: { icon?: ReactNode; tone?: string };
    title?: ReactNode;
  };
};

/**
 * O aviso.
 *
 * A estrutura e nossa — o icone a esquerda, o texto, o botao de fechar e a
 * barra de tempo. O comportamento e do Ark: o aviso entra deslizando, sai com
 * fade, e a regiao que o contem e anunciada pelo leitor de tela.
 */
export function AlertToast(props: AlertToastProps): ReactElement {
  const { toast } = props;
  const icon = toast.meta?.icon ?? null;
  const tone = toast.meta?.tone ?? 'fg.muted';
  const duration = toast.duration ?? 0;
  const close = handleClose(toast.id);
  return (
    <ChakraToast.Root
      alignItems="flex-start"
      bg="bg.panel"
      borderColor="border"
      borderRadius="sm"
      borderWidth="1px"
      boxShadow="overlay"
      gap="3"
      maxWidth="calc(100vw - 2rem)"
      padding="4"
      width="max-content"
    >
      <IconBadge size="2.25rem" tone={tone}>
        {icon}
      </IconBadge>
      <Box flex="1" minW="0" overflowWrap="anywhere" paddingBlockStart="1">
        {toast.title}
      </Box>
      <AlertClose onClick={close} />
      <AlertProgress duration={duration} />
    </ChakraToast.Root>
  );
}

function handleClose(id: string | undefined): () => void {
  return function close(): void {
    if (!id) {
      return;
    }
    alertToaster.dismiss(id);
  };
}
