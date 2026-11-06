import { Button, Card, Center, Heading, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react';

import { createForm } from '~/shared/ui/Form';

import {
  CreateCharacterSchema,
  type CreateCharacterOutput,
} from '../model/create-character-schema';

const defaultValues = { name: '' };

const Form = createForm(CreateCharacterSchema);

function onSubmit(_values: CreateCharacterOutput): void {
  return undefined;
}

export function CreateCharacterForm(): React.ReactElement {
  return (
    <Stack gap="10">
      <Heading size="6xl">Creatures</Heading>
      <Form defaultValues={defaultValues} onSubmit={onSubmit}>
        <Card.Root>
          <Card.Header>
            <Heading>Criar Personagem</Heading>
          </Card.Header>
          <Card.Body>
            <Stack gap="4">
              <Center h="16" w="16">
                <Text fontSize="3xl">M</Text>
              </Center>
              <Form.Field label="Nome" name="name" render={Input} required />
              <Stack gap="2">
                <Text>Gênero</Text>
                <SimpleGrid columns={2} gap="3">
                  <Button type="button" variant="subtle">
                    Masculino
                  </Button>
                  <Button type="button" variant="ghost">
                    Feminino
                  </Button>
                </SimpleGrid>
              </Stack>
            </Stack>
          </Card.Body>
          <Card.Footer>
            <Form.Submit>Criar Personagem</Form.Submit>
            <Button type="button" variant="subtle">
              Cancelar
            </Button>
          </Card.Footer>
        </Card.Root>
      </Form>
      <Text color="fg.muted">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}
