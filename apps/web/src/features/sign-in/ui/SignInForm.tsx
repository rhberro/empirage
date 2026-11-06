import { Button, Card, Heading, Input, Stack, Text } from '@chakra-ui/react';

import { createForm } from '~/shared/ui/Form';

import { SignInSchema, type SignInOutput } from '../model/sign-in-schema';

const defaultValues = { email: '', password: '' };

const Form = createForm(SignInSchema);

function onSubmit(_values: SignInOutput): void {
  return undefined;
}

export function SignInForm(): React.ReactElement {
  return (
    <Stack gap="10">
      <Heading size="6xl">Creatures</Heading>
      <Form defaultValues={defaultValues} onSubmit={onSubmit}>
        <Card.Root>
          <Card.Header>
            <Heading>Entrar</Heading>
          </Card.Header>
          <Card.Body>
            <Stack gap="4">
              <Form.Field label="E-mail" name="email" render={Input} required type="email" />
              <Form.Field label="Senha" name="password" render={Input} required type="password" />
            </Stack>
          </Card.Body>
          <Card.Footer>
            <Form.Submit>Entrar</Form.Submit>
            <Button type="button" variant="subtle">
              Criar Conta
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
