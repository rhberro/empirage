import { Box, Button, Grid, Heading, Separator, Stack, Text } from '@chakra-ui/react';

const screenGap = { base: '8', md: '12' };
const titleSize = { base: '4xl', md: '6xl' };
const panelPadding = { base: '6', md: '8' };

const characterRow = (
  <Grid
    alignItems="center"
    borderColor="border.default"
    borderWidth="1px"
    gap="4"
    p="4"
    templateColumns="auto 1fr auto"
  >
    <Box borderColor="border.default" borderWidth="1px" h="12" w="12" />
    <Stack gap="0">
      <Text>Nome</Text>
      <Text>Nível 1</Text>
    </Stack>
    <Button type="button" variant="outline">
      Excluir
    </Button>
  </Grid>
);

const listActions = (
  <Stack gap="3">
    <Button type="button" variant="outline" w="full">
      Entrar
    </Button>
    <Button type="button" variant="outline" w="full">
      Sair
    </Button>
  </Stack>
);

export function CharacterList(): React.ReactElement {
  return (
    <Stack align="center" gap={screenGap} w="full">
      <Heading color="fg.default" fontFamily="heading" fontSize={titleSize} textAlign="center">
        Creatures
      </Heading>
      <Stack
        bg="surface.sunken"
        borderColor="border.emphasized"
        borderWidth="1px"
        boxShadow="panel"
        gap="6"
        maxW="md"
        p={panelPadding}
        w="full"
      >
        <Heading color="brand.emphasized" fontFamily="heading" fontSize="2xl" textAlign="center">
          Personagens
        </Heading>
        <Stack gap="4">
          {characterRow}
          {characterRow}
          <Button borderStyle="dashed" type="button" variant="outline">
            + Criar personagem
          </Button>
        </Stack>
        <Separator />
        {listActions}
      </Stack>
      <Text color="fg.muted" fontFamily="body" fontSize="sm" maxW="sm" textAlign="center">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}
