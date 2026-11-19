/* eslint-disable oxsome/no-inline-structural-types */
import { Box, HStack, Spinner, Text } from '@chakra-ui/react';

export function MapEditorLoading(): React.ReactElement {
  return (
    <Box
      alignItems="center"
      bg="gray.950"
      color="white"
      display="flex"
      h="100vh"
      justifyContent="center"
    >
      <HStack gap="3">
        <Spinner />
        <Text>Carregando Editor de Mapas...</Text>
      </HStack>
    </Box>
  );
}
