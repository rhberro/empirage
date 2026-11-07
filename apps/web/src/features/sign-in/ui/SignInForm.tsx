import { Button, Card, Heading, Input, Stack, Text } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';

import { signIn } from '~/shared/auth';
import { createForm } from '~/shared/ui/Form';

import { SignInSchema, type SignInOutput } from '../model/sign-in-schema';
import { SignInError } from './SignInError';

const defaultValues = { email: '', password: '' };

const Form = createForm(SignInSchema);

export function SignInForm(): React.ReactElement {
  const navigate = useNavigate();

  async function onSubmit(values: SignInOutput): Promise<void> {
    const success = await signIn(values);
    if (success) {
      await navigate('/characters');
    }
  }

  return (
    <Stack align="center" gap="10">
      <Heading size="7xl" textAlign="center" fontWeight="bold">
        <Text textStyle="2xl">THE KINGDOM OF</Text>
        CREATURES
      </Heading>
      <Form defaultValues={defaultValues} onSubmit={onSubmit}>
        <Card.Root w="md" variant="elevated">
          <Card.Header>
            <Card.Title>Bem-vindo,</Card.Title>
            <Card.Description>
              Digite o seu e-mail e senha para acessar a sua conta.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <Stack gap="4">
              <Form.Field label="E-mail" name="email" render={Input} required type="email" />
              <Form.Field label="Senha" name="password" render={Input} required type="password" />
              <SignInError />
            </Stack>
          </Card.Body>
          <Card.Footer>
            <Form.Submit w="full">Entrar</Form.Submit>
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
