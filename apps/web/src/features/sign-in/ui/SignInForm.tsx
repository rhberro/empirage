import { Button, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { FormField } from "~/shared/ui/FormField";
import { useZodForm } from "~/shared/lib/use-zod-form";

import { SignInSchema, type SignInValues } from "../model/sign-in-schema";

const defaultValues = { email: "", password: "" };
const screenGap = { base: "8", md: "12" };
const titleSize = { base: "4xl", md: "6xl" };
const panelPadding = { base: "6", md: "8" };
const noticeSize = { base: "md", md: "lg" };

function onSubmit(_values: SignInValues): void {
  return undefined;
}

const formActions = (
  <Stack gap="3">
    <Button type="submit" w="full">
      Entrar
    </Button>
    <Button type="button" variant="outline" w="full">
      Criar Conta
    </Button>
  </Stack>
);

const legalNotice = (
  <Text color="fg.muted" fontFamily="body" fontSize={noticeSize} maxW="md" textAlign="center">
    Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do Creatures.
  </Text>
);

export function SignInForm(): React.ReactElement {
  const form = useZodForm(SignInSchema, defaultValues);
  const submit = form.handleSubmit(onSubmit);

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
          gap="8"
          maxW="md"
          p={panelPadding}
          w="full"
        >
          <Heading color="brand.emphasized" fontFamily="heading" fontSize="3xl" textAlign="center">
            Entrar
          </Heading>
          <Stack gap="5">
            <FormField
              control={form.control}
              label="E-mail"
              name="email"
              render={Input}
              required
              type="email"
            />
            <FormField
              control={form.control}
              label="Senha"
              name="password"
              render={Input}
              required
              type="password"
            />
          </Stack>
          {formActions}
        </Stack>
      </form>
      {legalNotice}
    </Stack>
  );
}
