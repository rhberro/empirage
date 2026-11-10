import { Button, Card, Input, Stack, Text } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';

import { signUp, type SignUpCredentials } from '~/shared/auth';
import { createForm } from '~/shared/ui/Form';

import { SignUpInput, SignUpSchema, type SignUpOutput } from '../model/sign-up-schema';
import { SignUpError } from './SignUpError';

const defaultValues: SignUpInput = { email: '', password: '', passwordConfirmation: '' };

const Form = createForm(SignUpSchema);

export function SignUpForm(): React.ReactElement {
  const navigate = useNavigate();
  async function onSubmit(values: SignUpOutput): Promise<void> {
    const credentials: SignUpCredentials = { email: values.email, password: values.password };
    const success = await signUp(credentials);
    if (success) {
      await navigate('/characters');
    }
  }
  return (
    <Stack gap="10">
      <Form defaultValues={defaultValues} onSubmit={onSubmit}>
        <Card.Root variant="subtle">
          <Card.Header>
            <Card.Title>Bem-vindo,</Card.Title>
            <Card.Description>Digite o seu e-mail e senha para criar a sua conta.</Card.Description>
          </Card.Header>
          <Card.Body>
            <Stack gap="4">
              <Form.Field label="E-mail" name="email" render={Input} required type="email" />
              <Form.Field label="Senha" name="password" render={Input} required type="password" />
              <Form.Field
                label="Confirmar Senha"
                name="passwordConfirmation"
                render={Input}
                required
                type="password"
              />
              <SignUpError />
            </Stack>
          </Card.Body>
          <Card.Footer>
            <Form.Submit>Criar Conta</Form.Submit>
            <Button asChild>
              <Link to="/signin">Entrar</Link>
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
