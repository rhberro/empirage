import {
  Badge,
  Button,
  Dialog,
  FormatNumber,
  HStack,
  IconButton,
  Image,
  NumberInput,
  RadioCard,
  Show,
  Stack,
} from '@chakra-ui/react';
import * as React from 'react';
import { useWatch } from 'react-hook-form';

import { createForm } from '~/shared/ui/Form';
import { Icon } from '~/shared/ui/Icon';
import { NumberInputField } from '~/shared/ui/NumberInput';
import { RadioCardField } from '~/shared/ui/RadioCard';

import type { HealingItem } from '../api/hunt-protocol';
import {
  type HealingConfigurationInput,
  HealingConfigurationSchema,
} from '../model/healing-configuration';

type HealingItemDialogFieldsProps = { items: HealingItems };
type HealingItems = Array<HealingItem>;

const Form = createForm(HealingConfigurationSchema);

export function HealingItemDialogFields(props: HealingItemDialogFieldsProps): React.ReactElement {
  const { items } = props;
  const values = useWatch<HealingConfigurationInput>();
  const selectedItem = findHealingItem(items, values.itemId);
  const itemOptions = items.map(renderItem);
  const currentCost = selectedItem ? selectedItem.goldCost : 0;
  return (
    <>
      <Dialog.Body>
        <Stack gap="4">
          <Form.Field
            label="Quando usar"
            max={100}
            min={5}
            name="thresholdPercentage"
            render={NumberInputField}
            required
            step={5}
            unstyled
          >
            <HStack gap="3" w="full">
              <NumberInput.DecrementTrigger asChild>
                <IconButton variant="outline">
                  <Icon name="remove" />
                </IconButton>
              </NumberInput.DecrementTrigger>
              <NumberInput.ValueText textAlign="center" minW="8" />
              <NumberInput.IncrementTrigger asChild>
                <IconButton variant="outline">
                  <Icon name="add" />
                </IconButton>
              </NumberInput.IncrementTrigger>
            </HStack>
          </Form.Field>
          <Form.Field label="Qual usar" name="itemId" render={RadioCardField} required w="full">
            <RadioCard.Item value="0">
              <RadioCard.ItemHiddenInput />
              <RadioCard.ItemControl alignItems="center">
                <Icon name="block" textStyle="xl" />
                <RadioCard.ItemText>Nenhum</RadioCard.ItemText>
                <RadioCard.ItemIndicator />
              </RadioCard.ItemControl>
            </RadioCard.Item>
            {itemOptions}
          </Form.Field>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <Show when={selectedItem}>
          Custo por uso:
          <Badge colorPalette="yellow">
            ₽ <FormatNumber value={currentCost} />
          </Badge>
        </Show>
        <Dialog.ActionTrigger asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </Dialog.ActionTrigger>
        <Form.Submit>Salvar</Form.Submit>
      </Dialog.Footer>
    </>
  );
}

function findHealingItem(items: HealingItems, itemId: string | undefined): HealingItem | undefined {
  const numericItemId = Number(itemId);
  for (const item of items) {
    if (item.id === numericItemId) {
      return item;
    }
  }
  return undefined;
}

function renderItem(item: HealingItem): React.ReactElement {
  const src = '/assets/items/medicine/' + item.slug + '.png';
  const description = item.restoresFullHealth ? '100% do HP' : item.healingAmount + ' HP';
  const value = item.id.toString();
  return (
    <RadioCard.Item value={value}>
      <RadioCard.ItemHiddenInput />
      <RadioCard.ItemControl alignItems="center">
        <Image src={src} />
        <RadioCard.ItemText>{item.name}</RadioCard.ItemText>
        <RadioCard.ItemDescription>
          <span>Restaura {description}</span>
        </RadioCard.ItemDescription>
        <RadioCard.ItemIndicator />
      </RadioCard.ItemControl>
    </RadioCard.Item>
  );
}
