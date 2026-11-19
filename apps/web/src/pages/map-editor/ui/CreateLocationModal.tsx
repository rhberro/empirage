/* eslint-disable oxsome/no-inline-structural-types */
import { Button, Dialog, Field, HStack, Input, Stack, Textarea } from '@chakra-ui/react';
import { useState } from 'react';

import type { CreateHuntingLocationPayload } from '~/entities/hunting-location';

type CloseHandler = () => void;
type CreateHandler = (payload: CreateHuntingLocationPayload) => Promise<void>;

export interface CreateLocationModalProps {
  isCreating: boolean;
  onClose: CloseHandler;
  onCreate: CreateHandler;
  open: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036F]/gu, '')
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/(^-|-$)+/gu, '');
}

export function CreateLocationModal(props: CreateLocationModalProps): React.ReactElement {
  const { isCreating, onClose, onCreate, open } = props;
  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');

  function handleOpenChange(): void {
    if (!isCreating) {
      onClose();
    }
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value;
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(slugify(val));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setSlugManuallyEdited(true);
    setSlug(e.target.value);
  }

  function handleDescChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setDescription(e.target.value);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || isCreating) {
      return;
    }
    const createData: CreateHuntingLocationPayload = {
      description: description.trim(),
      name: name.trim(),
      slug: slug.trim(),
    };
    await onCreate(createData);
  }

  const canSubmit = name.trim().length >= 2 && slug.trim().length >= 2 && !isCreating;
  const isSubmitDisabled = !canSubmit;

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open} size="md">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg="gray.900" color="white" p="6">
          <form onSubmit={handleSubmit}>
            <Dialog.Header>
              <Dialog.Title fontSize="lg" fontWeight="bold">
                Criar Novo Local de Caça
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack mb="6" spaceY="4">
                <Field.Root required>
                  <Field.Label fontSize="sm">Nome</Field.Label>
                  <Input
                    bg="gray.950"
                    onChange={handleNameChange}
                    placeholder="Ex: Rota 26, Caverna Misteriosa"
                    value={name}
                  />
                </Field.Root>

                <Field.Root required>
                  <Field.Label fontSize="sm">Slug (identificador único)</Field.Label>
                  <Input
                    bg="gray.950"
                    onChange={handleSlugChange}
                    placeholder="Ex: rota-26, caverna-misteriosa"
                    value={slug}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label fontSize="sm">Descrição</Field.Label>
                  <Textarea
                    bg="gray.950"
                    onChange={handleDescChange}
                    placeholder="Descrição breve do local..."
                    rows={3}
                    value={description}
                  />
                </Field.Root>
              </Stack>

              <HStack justify="flex-end" spaceX="3">
                <Button disabled={isSubmitDisabled} loading={isCreating} type="submit">
                  Criar Local
                </Button>
                <Button disabled={isCreating} onClick={onClose} variant="subtle">
                  Cancelar
                </Button>
              </HStack>
            </Dialog.Body>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
