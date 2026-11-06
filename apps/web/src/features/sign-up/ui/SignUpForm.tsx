import { Button, Card, Heading, Input, Stack, Text } from '@chakra-ui/react';

import { createForm } from '~/shared/ui/Form';

import { SignUpSchema, type SignUpOutput } from '../model/sign-up-schema';

const defaultValues = { email: '', password: '', passwordConfirmation: '' };

const Form = createForm(SignUpSchema);

function onSubmit(_values: SignUpOutput): void {
  return undefined;
}

export function SignUpForm(): React.ReactElement {
  return (
    <Stack gap="10">
      <Heading size="6xl">Creatures</Heading>
      <Form defaultValues={defaultValues} onSubmit={onSubmit}>
        <Card.Root>
          <Card.Header>
            <Heading>Criar Conta</Heading>
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
            </Stack>
          </Card.Body>
          <Card.Footer>
            <Form.Submit>Criar Conta</Form.Submit>
            <Button type="button" variant="subtle">
              Entrar
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
