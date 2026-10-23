import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { FOUNDATION_SCALES, type FoundationScale, type FoundationSwatch } from '~/shared/theme';
import { Text } from '~/shared/ui/text';

import { SectionHeader } from './SectionHeader';

export function ColorFoundations(): ReactElement {
  const scales = FOUNDATION_SCALES.map(renderScale);
  return (
    <Box marginBlockEnd="16">
      <SectionHeader
        description="Base azul-cinza para superfícies, e uma cor por papel do jogo. Toda cor de elemento vem sempre com ícone e rótulo, nunca só o matiz."
        id="cores"
        title="Cores"
      />
      {scales}
    </Box>
  );
}

function renderScale(scale: FoundationScale): ReactElement {
  const swatches = scale.swatches.map(renderSwatch);
  return (
    <Box
      bg="bg.panel"
      borderRadius="lg"
      boxShadow="raised"
      key={scale.label}
      marginBlockEnd="3"
      padding="4"
    >
      <Box alignItems="baseline" display="flex" gap="3" marginBlockEnd="3">
        <Text color="fg" variant="section">
          {scale.label}
        </Text>
        <Text color="fg.subtle" variant="meta">
          {scale.role}
        </Text>
      </Box>
      <Box display="flex" gap="1">
        {swatches}
      </Box>
    </Box>
  );
}

function renderSwatch(swatch: FoundationSwatch): ReactElement {
  return (
    <Box flex="1" key={swatch.step} minW="0">
      <Box bg={swatch.hex} borderRadius="xs" height="2.125rem" title={swatch.hex} />
      <Text color="fg.subtle" marginBlockStart="1" variant="numeric">
        {swatch.step}
      </Text>
    </Box>
  );
}
