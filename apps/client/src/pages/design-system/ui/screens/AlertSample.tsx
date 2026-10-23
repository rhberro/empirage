import { Box } from '@chakra-ui/react';
import { type ReactElement, useEffect, useRef } from 'react';

import { useAlerts } from '~/shared/ui/alert';
import { IconPotion } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

const ALERT_DURATION = 6000;
const EMPTY_DEPS: ReadonlyArray<unknown> = [];

/**
 * O aviso de verdade.
 *
 * A galeria dispara o mesmo aviso que o jogo dispara — o `Toaster` do
 * Chakra, com a regiao `aria-live` e a barra de tempo.
 */
export function AlertSample(): ReactElement {
  const { show } = useAlerts();
  const shown = useRef<boolean>(false);

  function showSample(): void {
    // O StrictMode executa o efeito duas vezes: o ref segura o aviso unico.
    if (shown.current) {
      return;
    }
    shown.current = true;
    show(buildSample());
  }

  useEffect(showSample, EMPTY_DEPS);

  return (
    <Box width="20rem">
      <Text color="fg.muted" variant="body">
        O aviso aparece no canto superior direito, com regiao aria-live e barra de tempo.
      </Text>
    </Box>
  );
}

function buildSample(): {
  content: ReactElement;
  duration: number;
  icon: ReactElement;
  tone: string;
} {
  return {
    content: (
      <Box>
        <Text color="fg" variant="label">
          Poção de Cura
        </Text>
        <Text color="fg.muted" variant="meta">
          Adicionada à mochila
        </Text>
      </Box>
    ),
    duration: ALERT_DURATION,
    icon: <IconPotion />,
    tone: 'arcane.fg',
  };
}
