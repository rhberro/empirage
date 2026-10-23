import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';

const STATES = ['Carregando', 'Vazio', 'Erro', 'Populado', 'Limite'] as const;

export function StateCoverage(): ReactElement {
  const cells = STATES.map(renderState);
  return (
    <Box display="grid" gap="3" gridTemplateColumns="repeat(5, 1fr)">
      {cells}
    </Box>
  );
}

function renderState(state: (typeof STATES)[number]): ReactElement {
  const body = renderStateBody(state);
  return (
    <Box key={state}>
      <Text color="fg.muted" marginBlockEnd="2" variant="meta">
        {state}
      </Text>
      <Box bg="bg.panel" borderRadius="sm" boxShadow="raised" minH="7.5rem" padding="3">
        {body}
      </Box>
    </Box>
  );
}

function renderStateBody(state: (typeof STATES)[number]): ReactElement {
  if (state === 'Carregando') {
    return <LoadingState />;
  }
  if (state === 'Vazio') {
    return <EmptyState />;
  }
  if (state === 'Erro') {
    return <ErrorState />;
  }
  if (state === 'Limite') {
    return <EdgeState />;
  }
  return <PopulatedState />;
}

function LoadingState(): ReactElement {
  return (
    <Box alignItems="center" display="flex" height="5.625rem" justifyContent="center">
      <Box
        borderColor="arcane.500"
        borderRadius="full"
        borderStyle="solid"
        borderTopColor="transparent"
        borderWidth="2px"
        height="1.25rem"
        width="1.25rem"
      />
    </Box>
  );
}

function EmptyState(): ReactElement {
  return (
    <Box
      alignItems="center"
      display="flex"
      flexDirection="column"
      height="5.625rem"
      justifyContent="center"
    >
      <Text color="fg.muted" textAlign="center" variant="body">
        Nenhum item encontrado
      </Text>
      <Text color="arcane.300" marginBlockStart="1" variant="label">
        Buscar de novo
      </Text>
    </Box>
  );
}

function ErrorState(): ReactElement {
  return (
    <Box
      alignItems="center"
      display="flex"
      flexDirection="column"
      height="5.625rem"
      justifyContent="center"
    >
      <Text color="fg.error" textAlign="center" variant="body">
        Não foi possível carregar a mochila
      </Text>
      <Text color="arcane.300" marginBlockStart="1" variant="label">
        Tentar de novo
      </Text>
    </Box>
  );
}

function EdgeState(): ReactElement {
  return (
    <Box display="flex" flexDirection="column" gap="2" height="5.625rem" justifyContent="center">
      <Text color="fg.muted" variant="body">
        Poção de Cura Interminável
      </Text>
      <Box bg="bg.raised" borderRadius="xs" height="0.375rem" width="100%" />
    </Box>
  );
}

function PopulatedState(): ReactElement {
  return (
    <Box display="flex" flexDirection="column" gap="2" height="5.625rem" justifyContent="center">
      <Text color="fg" variant="body">
        Poção de Cura
      </Text>
      <Box bg="bg.raised" borderRadius="xs" height="0.375rem" width="70%" />
    </Box>
  );
}
