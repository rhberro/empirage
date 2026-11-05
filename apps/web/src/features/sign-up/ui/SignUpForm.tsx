import { Button, Card, Heading, Input, Stack, Text } from '@chakra-ui/react';

import { useZodForm } from '~/shared/lib/use-zod-form';
import { FormField } from '~/shared/ui/FormField';
import { FormSubmit } from '~/shared/ui/FormSubmit';

import { SignUpSchema, type SignUpOutput } from '../model/sign-up-schema';

const defaultValues = { email: '', password: '', passwordConfirmation: '' };

function onSubmit(_values: SignUpOutput): void {
  return undefined;
}

export function SignUpForm(): React.ReactElement {
  const { control, handleSubmit } = useZodForm(SignUpSchema, defaultValues);
  const submit = handleSubmit(onSubmit);
  return (
    <Stack gap="10">
      <Heading size="6xl">Creatures</Heading>
      <Card.Root>
        <Card.Header>
          <Heading>Criar Conta</Heading>
        </Card.Header>
        <Card.Body>
          <Stack as="form" gap="5" onSubmit={submit}>
            <Stack gap="4">
              <FormField
                control={control}
                label="E-mail"
                name="email"
                render={Input}
                required
                type="email"
              />
              <FormField
                control={control}
                label="Senha"
                name="password"
                render={Input}
                required
                type="password"
              />
              <FormField
                control={control}
                label="Confirmar Senha"
                name="passwordConfirmation"
                render={Input}
                required
                type="password"
              />
            </Stack>
          </Stack>
        </Card.Body>
        <Card.Footer>
          <FormSubmit control={control}>Criar Conta</FormSubmit>
          <Button type="button" variant="outline">
            Entrar
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
