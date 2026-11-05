import { Box, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react';

import { CharacterList } from '~/features/character-list';
import { CreateCharacterForm } from '~/features/create-character';
import { SignInForm } from '~/features/sign-in';
import { SignUpForm } from '~/features/sign-up';

const pagePadding = { base: '5', md: '10' };
const catalogColumns = { base: 1, xl: 2 };
const catalogGap = { base: '8', xl: '10' };
const containerMinH = { base: '42rem', md: '48rem' };
const containerPadding = { base: '5', md: '8' };

const signInContainer = (
  <Box
    as="article"
    bg="surface.panel"
    borderColor="border.emphasized"
    borderWidth="1px"
    boxShadow="panel"
    minH={containerMinH}
    p={containerPadding}
    w="full"
  >
    <SignInForm />
  </Box>
);

const signUpContainer = (
  <Box
    as="article"
    bg="surface.panel"
    borderColor="border.emphasized"
    borderWidth="1px"
    boxShadow="panel"
    minH={containerMinH}
    p={containerPadding}
    w="full"
  >
    <SignUpForm />
  </Box>
);

const createCharacterContainer = (
  <Box
    as="article"
    bg="surface.panel"
    borderColor="border.emphasized"
    borderWidth="1px"
    boxShadow="panel"
    minH={containerMinH}
    p={containerPadding}
    w="full"
  >
    <CreateCharacterForm />
  </Box>
);

const characterListContainer = (
  <Box
    as="article"
    bg="surface.panel"
    borderColor="border.emphasized"
    borderWidth="1px"
    boxShadow="panel"
    minH={containerMinH}
    p={containerPadding}
    w="full"
  >
    <CharacterList />
  </Box>
);

export function DesignSystemPage(): React.ReactElement {
  return (
    <Box bg="bg.canvas" minH="100dvh" p={pagePadding}>
      <Stack gap="10" mx="auto" maxW="7xl">
        <Stack gap="2">
          <Text
            color="brand.solid"
            fontFamily="ui"
            fontSize="sm"
            fontWeight="bold"
            letterSpacing="wide"
          >
            VISUAL CATALOG
          </Text>
          <Heading color="brand.emphasized" fontFamily="heading">
            Design system
          </Heading>
          <Text color="fg.muted" maxW="2xl">
            Telas para acompanhar a evolução dos componentes e do tema.
          </Text>
        </Stack>
        <SimpleGrid columns={catalogColumns} gap={catalogGap}>
          {signInContainer}
          {signUpContainer}
          {createCharacterContainer}
          {characterListContainer}
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
