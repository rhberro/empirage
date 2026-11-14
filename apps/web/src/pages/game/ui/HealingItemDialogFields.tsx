import {
  Badge,
  Box,
  Button,
  Dialog,
  FormatNumber,
  HStack,
  IconButton,
  Image,
  NumberInput,
  RadioCard,
  Stack,
  Text,
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
      <Dialog.Body display="flex" flex="1" flexDirection="column" minH="0">
        <Stack gap="4" h="full" minH="0">
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
          <Stack flex="1" minH="0" gap="2">
            <Text fontSize="sm" fontWeight="bold">
              Item para usar
            </Text>
            <Box flex="1" minH="0" overflowY="auto" pe="2">
              <Form.Field name="itemId" render={RadioCardField} required w="full">
                <RadioCard.Item value="0">
                  <RadioCard.ItemHiddenInput />
                  <RadioCard.ItemControl alignItems="center">
                    <Icon name="block" textStyle="xl" />
                    <RadioCard.ItemText>Não usar item</RadioCard.ItemText>
                    <RadioCard.ItemIndicator />
                  </RadioCard.ItemControl>
                </RadioCard.Item>
                {itemOptions}
              </Form.Field>
            </Box>
          </Stack>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <HStack flex="1" justify="flex-start">
          <Text color="fg.muted" fontSize="sm">
            Custo por uso
          </Text>
          <Badge colorPalette="yellow">
            ₽ <FormatNumber value={currentCost} />
          </Badge>
        </HStack>
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
    <RadioCard.Item key={item.id} value={value}>
      <RadioCard.ItemHiddenInput />
      <RadioCard.ItemControl alignItems="center">
        <Image alt="" boxSize="9" src={src} />
        <RadioCard.ItemText>{item.name}</RadioCard.ItemText>
        <RadioCard.ItemDescription>
          <span>Restaura {description}</span>
        </RadioCard.ItemDescription>
        <RadioCard.ItemIndicator />
      </RadioCard.ItemControl>
    </RadioCard.Item>
  );
}
