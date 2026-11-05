import { Button, Center, Heading, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react';

import { useZodForm } from '~/shared/lib/use-zod-form';
import { FormField } from '~/shared/ui/FormField';

import {
  CreateCharacterSchema,
  type CreateCharacterValues,
} from '../model/create-character-schema';

const defaultValues = { name: '' };
const screenGap = { base: '8', md: '12' };
const titleSize = { base: '4xl', md: '6xl' };
const panelPadding = { base: '6', md: '8' };

function onSubmit(_values: CreateCharacterValues): void {
  return undefined;
}

const genderOptions = (
  <SimpleGrid borderColor="border.default" borderWidth="1px" columns={2} gap="3" p="2">
    <Button type="button" variant="solid">
      Masculino
    </Button>
    <Button type="button" variant="outline">
      Feminino
    </Button>
  </SimpleGrid>
);

const formActions = (
  <Stack gap="3">
    <Button type="submit" w="full">
      Criar Personagem
    </Button>
    <Button type="button" variant="outline" w="full">
      Cancelar
    </Button>
  </Stack>
);

export function CreateCharacterForm(): React.ReactElement {
  const form = useZodForm(CreateCharacterSchema, defaultValues);
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
          gap="6"
          maxW="md"
          p={panelPadding}
          w="full"
        >
          <Heading color="brand.emphasized" fontFamily="heading" fontSize="2xl" textAlign="center">
            Criar Personagem
          </Heading>
          <Center alignSelf="center" borderColor="border.default" borderWidth="1px" h="16" w="16">
            <Text fontSize="3xl">M</Text>
          </Center>
          <Stack gap="4">
            <FormField control={form.control} label="Nome" name="name" render={Input} required />
            <Stack gap="2">
              <Text>Gênero</Text>
              {genderOptions}
            </Stack>
          </Stack>
          {formActions}
        </Stack>
      </form>
      <Text color="fg.muted" fontFamily="body" fontSize="sm" maxW="sm" textAlign="center">
        Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do
        Creatures.
      </Text>
    </Stack>
  );
}
