import { Button, Card, Input, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { createForm } from '~/shared/ui/Form';
import { SegmentedControlField } from '~/shared/ui/SegmentedControl';

import { createCharacter, type CreateCharacterError } from '../api/create-character';
import {
  type CreateCharacterInput,
  CreateCharacterSchema,
  type CreateCharacterOutput,
} from '../model/create-character-schema';
import { CreateCharacterErrorAlert } from './CreateCharacterErrorAlert';

const defaultValues: CreateCharacterInput = { gender: 'male', name: '' };

const Form = createForm(CreateCharacterSchema);

function getErrorMessage(error: CreateCharacterError): string {
  const details = `${error.code} ${error.message} ${error.details ?? ''}`.toLowerCase();

  if (
    details.includes('limit') ||
    details.includes('maximum') ||
    details.includes('5 characters')
  ) {
    return 'Você atingiu o limite de 5 personagens.';
  }

  if (
    error.code === '23505' ||
    details.includes('unavailable') ||
    details.includes('indispon') ||
    details.includes('already exists') ||
    details.includes('duplicate')
  ) {
    return 'Nome indisponível.';
  }

  return 'Não foi possível criar o personagem. Tente novamente.';
}

export function CreateCharacterForm(): React.ReactElement {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  async function onSubmit(values: CreateCharacterOutput): Promise<void> {
    setErrorMessage(null);
    const { error } = await createCharacter(values);
    if (error) {
      setErrorMessage(getErrorMessage(error));
      return;
    }
    await navigate('/characters');
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
