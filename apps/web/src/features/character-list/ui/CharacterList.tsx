import { Box, Button, Card, Grid, Heading, Stack, Text } from '@chakra-ui/react';

export function CharacterList(): React.ReactElement {
  return (
    <Stack gap="10">
      <Heading size="6xl">Creatures</Heading>
      <Card.Root>
        <Card.Header>
          <Heading>Personagens</Heading>
        </Card.Header>
        <Card.Body>
          <Stack gap="4">
            <Grid alignItems="center" gap="4" templateColumns="auto 1fr auto">
              <Box h="12" w="12" />
              <Stack>
                <Text>Nome</Text>
                <Text>Nível 1</Text>
              </Stack>
              <Button type="button">Excluir</Button>
            </Grid>
            <Grid alignItems="center" gap="4" templateColumns="auto 1fr auto">
              <Box h="12" w="12" />
              <Stack>
                <Text>Nome</Text>
                <Text>Nível 1</Text>
              </Stack>
              <Button type="button">Excluir</Button>
            </Grid>
            <Button type="button" variant="subtle">
              + Criar personagem
            </Button>
          </Stack>
        </Card.Body>
        <Card.Footer>
          <Button type="button">Entrar</Button>
          <Button type="button" variant="subtle">
            Sair
          </Button>
        </Card.Footer>
      </Card.Root>
      <Text color="fg.muted">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}
