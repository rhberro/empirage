import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';

export type HuntAreaLevelsProps = {
  /** The lowest level that can hunt in the area. */
  minimumLevel: number;
  /** The level the area recommends. */
  recommendedLevel: number;
};

/**
 * The levels of an area.
 *
 * O nivel recomendado e o minimo sao os dois numeros que o jogador precisa
 * antes de entrar na area. Os rotulos sao curtos de proposito: um rotulo
 * longo quebra a linha e deixa a caixa do local torta.
 */
export function HuntAreaLevels(props: HuntAreaLevelsProps): ReactElement {
  const { minimumLevel, recommendedLevel } = props;
  const levelText = `Nível ${recommendedLevel}`;
  const minimumText = `Min. ${minimumLevel}`;
  return (
    <Box alignItems="center" display="flex" gap="2" justifyContent="center">
      <Text color="fg.muted" variant="meta">
        {levelText}
      </Text>
      <Text color="fg.subtle" variant="meta">
        {minimumText}
      </Text>
    </Box>
  );
}
