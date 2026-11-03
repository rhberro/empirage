import { Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import type { Control } from "react-hook-form";

import { useZodForm } from "~/shared/lib/use-zod-form";
import { FormField } from "~/shared/ui/FormField";

import { SignUpSchema, type SignUpValues } from "../model/sign-up-schema";

const defaultValues = { email: "", password: "", passwordConfirmation: "" };
const screenGap = { base: "8", md: "12" };
const titleSize = { base: "4xl", md: "6xl" };
const panelPadding = { base: "6", md: "8" };
const noticeSize = { base: "md", md: "lg" };

function onSubmit(_values: SignUpValues): void {
  return undefined;
}

function renderFields(control: Control<SignUpValues>): React.ReactElement {
  return (
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
  );
}

const formActions = (
  <Stack gap="3">
    <Button type="submit" w="full">
      Criar Conta
    </Button>
    <Button type="button" variant="outline" w="full">
      Entrar
    </Button>
  </Stack>
);

export function SignUpForm(): React.ReactElement {
  const form = useZodForm(SignUpSchema, defaultValues);
  const submit = form.handleSubmit(onSubmit);
  const fields = renderFields(form.control);

  return (
    <Stack align="center" gap={screenGap} w="full">
      <Heading color="fg.default" fontFamily="heading" fontSize={titleSize} textAlign="center">
        Creatures
      </Heading>
      <form onSubmit={submit}>
        <Stack
          bg="surface.sunken"
          borderColor="border.emphasized"
          borderWidth="1px"
          boxShadow="panel"
          gap="7"
          maxW="md"
          p={panelPadding}
          w="full"
        >
          <Heading color="brand.emphasized" fontFamily="heading" fontSize="2xl" textAlign="center">
            Criar Conta
          </Heading>
          {fields}
          {formActions}
        </Stack>
      </form>
      <Text color="fg.muted" fontFamily="body" fontSize={noticeSize} maxW="md" textAlign="center">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}
