import { Button, Card, Input, Stack, Text } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

import { createForm } from '~/shared/ui/Form';
import { SegmentedControlField } from '~/shared/ui/SegmentedControl';

import {
  type CreateCharacterInput,
  CreateCharacterSchema,
  type CreateCharacterOutput,
} from '../model/create-character-schema';
import { getCreateCharacterErrorMessage } from '../model/get-create-character-error-message';
import { useCreateCharacter } from '../model/use-create-character';
import { CreateCharacterErrorAlert } from './CreateCharacterErrorAlert';

const defaultValues: CreateCharacterInput = { gender: 'male', name: '' };

const Form = createForm(CreateCharacterSchema);

export function CreateCharacterForm(): React.ReactElement {
  const createCharacterMutation = useCreateCharacter();
  const errorMessage = createCharacterMutation.error
    ? getCreateCharacterErrorMessage(createCharacterMutation.error)
    : null;
  async function onSubmit(values: CreateCharacterOutput): Promise<void> {
    try {
      await createCharacterMutation.mutateAsync(values);
    } catch {
      await Promise.resolve();
    }
  }
  return (
    <Stack gap="10">
      <Form defaultValues={defaultValues} onSubmit={onSubmit}>
        <Card.Root variant="subtle">
          <Card.Header>
            <Card.Title>Criar Personagem</Card.Title>
            <Card.Description>
              Crie um novo personagem para iniciar uma nova aventura.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <Stack gap="4">
              <Form.Field label="Nome" name="name" render={Input} required />
              <Form.Field
                items={items}
                label="Gênero"
                name="gender"
                render={SegmentedControlField}
                required
              />
              <CreateCharacterErrorAlert message={errorMessage} />
            </Stack>
          </Card.Body>
          <Card.Footer>
            <Form.Submit>Criar Personagem</Form.Submit>
            <Button asChild>
              <Link to="/characters">Voltar</Link>
            </Button>
          </Card.Footer>
        </Card.Root>
      </Form>
      <Text color="fg.muted" textAlign="center" textStyle="sm">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}

const items = [
  { label: 'Feminino', value: 'female' },
  { label: 'Masculino', value: 'male' },
];
