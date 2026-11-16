/* eslint-disable react/no-multi-comp, oxsome/no-inline-functions-objects-arrays, oxsome/no-jsx-inline-computation, oxsome/no-inline-structural-types, react/todo, unicorn/consistent-function-scoping */
import { Button, Checkbox, Dialog, HStack, Image, RadioCard, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { createForm } from '~/shared/ui/Form';
import { RadioCardField } from '~/shared/ui/RadioCard';

import type {
  CaptureConfiguration,
  CaptureItem,
  CaptureRarity,
  HuntCommand,
} from '../api/hunt-protocol';
import { selectCaptureModalState, toggleCaptureModal, useModalStore } from '../model/modal-store';

type CaptureDialogProps = {
  configuration: CaptureConfiguration | undefined;
  items: Array<CaptureItem>;
  onConfigure: (command: HuntCommand) => boolean;
};
type CaptureConfigurationInput = { itemId: string; rarities: Array<CaptureRarity> };
type CaptureConfigurationOutput = CaptureConfigurationInput;
type CaptureDialogFieldsProps = { items: Array<CaptureItem> };
type Rarity = { label: string; value: CaptureRarity };

const allRarities: Array<Rarity> = [
  { label: 'Comum', value: 'common' },
  { label: 'Incomum', value: 'uncommon' },
  { label: 'Rara', value: 'rare' },
  { label: 'Épica', value: 'epic' },
  { label: 'Lendária', value: 'legendary' },
];
const fields = {
  itemId: z.string().refine(isCaptureItemId, 'Selecione uma Pokébola.'),
  rarities: z.array(z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary'])),
};
const CaptureSchema = z.object(fields).refine(hasRaritiesWhenCapturing, 'Selecione uma raridade.');
const Form = createForm(CaptureSchema);

export function CaptureDialog(props: CaptureDialogProps): React.ReactElement {
  const { configuration, items, onConfigure } = props;
  const open = useModalStore(selectCaptureModalState);
  const defaultValues = captureDefaultValues(configuration);
  const formKey = captureFormKey(open, defaultValues);
  function save(values: CaptureConfigurationOutput): void {
    const command: HuntCommand = {
      captureItemId: Number(values.itemId),
      captureRarities: values.rarities,
      type: 'configure_capture',
      version: 1,
    };
    if (onConfigure(command)) {
      toggleCaptureModal();
    }
  }
  return (
    <Dialog.Root lazyMount onOpenChange={toggleCaptureModal} open={open} size="md">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text color="brand.solid" fontSize="xs" fontWeight="bold">
              CONFIGURAÇÃO DE CAPTURA
            </Text>
            <Dialog.Title>Pokébola automática</Dialog.Title>
          </Dialog.Header>
          <Form key={formKey} defaultValues={defaultValues} onSubmit={save}>
            <CaptureDialogFields items={items} />
          </Form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

function CaptureDialogFields(props: CaptureDialogFieldsProps): React.ReactElement {
  const { items } = props;
  const { setValue } = useFormContext<CaptureConfigurationInput>();
  const values = useWatch<CaptureConfigurationInput>();
  const itemId = Number(values.itemId);
  const rarities = values.rarities ?? [];
  const itemOptions = items.map(renderBall);
  const rarityOptions = allRarities.map(renderRarity);
  function renderBall(item: CaptureItem): React.ReactElement {
    return (
      <RadioCard.Item key={item.id} value={String(item.id)}>
        <RadioCard.ItemHiddenInput />
        <RadioCard.ItemControl>
          <RadioCard.ItemText>
            <HStack gap="2">
              <Image
                alt=""
                boxSize="6"
                imageRendering="pixelated"
                src={captureItemImageUrl(item)}
              />
              <span>
                {item.name} · ₽ {item.goldCost}
              </span>
            </HStack>
          </RadioCard.ItemText>
          <RadioCard.ItemIndicator />
        </RadioCard.ItemControl>
      </RadioCard.Item>
    );
  }
  function renderRarity(rarity: Rarity): React.ReactElement {
    const checked = rarities.includes(rarity.value);
    function change(details: Checkbox.CheckedChangeDetails): void {
      const nextRarities = details.checked
        ? [...rarities, rarity.value]
        : rarities.filter(function remaining(value): boolean {
            return value !== rarity.value;
          });
      setValue('rarities', nextRarities, { shouldDirty: true, shouldValidate: true });
    }
    return (
      <Checkbox.Root checked={checked} key={rarity.value} onCheckedChange={change}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>{rarity.label}</Checkbox.Label>
      </Checkbox.Root>
    );
  }
  return (
    <>
      <Dialog.Body>
        <Stack gap="5">
          <Stack gap="2">
            <Text fontWeight="bold">Pokébola</Text>
            <Form.Field name="itemId" render={RadioCardField} required w="full">
              <RadioCard.Item value="0">
                <RadioCard.ItemHiddenInput />
                <RadioCard.ItemControl>
                  <RadioCard.ItemText>Não capturar</RadioCard.ItemText>
                  <RadioCard.ItemIndicator />
                </RadioCard.ItemControl>
              </RadioCard.Item>
              {itemOptions}
            </Form.Field>
          </Stack>
          <Stack gap="2">
            <Text fontWeight="bold">Raridades alvo</Text>
            {rarityOptions}
          </Stack>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.ActionTrigger asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </Dialog.ActionTrigger>
        <Form.Submit disabled={itemId !== 0 && rarities.length === 0}>Salvar</Form.Submit>
      </Dialog.Footer>
    </>
  );
}

function captureDefaultValues(
  configuration: CaptureConfiguration | undefined,
): CaptureConfigurationInput {
  const itemId = configuration ? configuration.itemId : 0;
  const rarities = configuration ? configuration.rarities : allRarities.map(valueForRarity);
  return { itemId: String(itemId), rarities };
}
function captureFormKey(open: boolean, values: CaptureConfigurationInput): string {
  return String(open) + '-' + values.itemId + '-' + values.rarities.join('-');
}
function hasRaritiesWhenCapturing(values: CaptureConfigurationInput): boolean {
  return Number(values.itemId) === 0 || values.rarities.length > 0;
}
function isCaptureItemId(value: string): boolean {
  const itemId = Number(value);
  return Number.isSafeInteger(itemId) && itemId >= 0;
}
function captureItemImageUrl(item: CaptureItem): string {
  return `/assets/items/pokeballs/${item.slug}.png`;
}
function valueForRarity(rarity: Rarity): CaptureRarity {
  return rarity.value;
}
