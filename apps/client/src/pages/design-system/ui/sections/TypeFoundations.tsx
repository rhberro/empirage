import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { type TypeSample, TYPE_SAMPLES } from '~/shared/theme';
import { DIVIDER_BOTTOM } from '~/shared/theme';
import { Text } from '~/shared/ui/text';
import type { TextVariant } from '~/shared/ui/text';

import { SectionHeader } from './SectionHeader';

export function TypeFoundations(): ReactElement {
  const samples = TYPE_SAMPLES.map(renderTypeSample);
  return (
    <Box marginBlockEnd="16">
      <SectionHeader
        description="Cinzel carrega o nome do jogo e os nomes de criatura, com o serifa chanfrado de título gravado. Barlow Semi Condensed faz os rótulos de interface. Barlow o texto corrido, JetBrains Mono os números."
        id="tipografia"
        title="Tipografia"
      />
      {samples}
    </Box>
  );
}

function renderTypeSample(sample: TypeSample): ReactElement {
  const variant = sample.style as TextVariant;
  return (
    <Box
      alignItems="baseline"
      css={DIVIDER_BOTTOM}
      display="flex"
      gap="6"
      key={sample.style}
      paddingBlock="3"
    >
      <Box width="8.75rem">
        <Text color="fg.subtle" variant="meta">
          {sample.label}
        </Text>
      </Box>
      <Box flex="1" minW="0">
        <Text color="fg" variant={variant}>
          {sample.specimen}
        </Text>
      </Box>
    </Box>
  );
}
