/* eslint-disable oxsome/no-inline-functions-objects-arrays, oxsome/no-jsx-inline-computation, oxsome/no-inline-structural-types, react/todo, unicorn/consistent-function-scoping */
import { Button, Checkbox, Dialog, HStack, Image, RadioCard, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

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
type Rarity = { label: string; value: CaptureRarity };
const allRarities: Array<Rarity> = [
  { label: 'Comum', value: 'common' },
  { label: 'Incomum', value: 'uncommon' },
  { label: 'Rara', value: 'rare' },
  { label: 'Épica', value: 'epic' },
  { label: 'Lendária', value: 'legendary' },
];

export function CaptureDialog(props: CaptureDialogProps): React.ReactElement {
  const { configuration, items, onConfigure } = props;
  const open = useModalStore(selectCaptureModalState);
  const initialItem = configuration ? configuration.itemId : 0;
  const initialRarities = configuration ? configuration.rarities : allRarities.map(valueForRarity);
  const [itemId, setItemId] = React.useState(initialItem);
  const [rarities, setRarities] = React.useState<Array<CaptureRarity>>(initialRarities);
  function selectItem(details: RadioCard.ValueChangeDetails): void {
    setItemId(Number(details.value));
  }
  function save(): void {
    const command: HuntCommand = {
      captureItemId: itemId,
      captureRarities: rarities,
      type: 'configure_capture',
      version: 1,
    };
    if (onConfigure(command)) {
      toggleCaptureModal();
    }
  }
  const ballOptions = items.map(renderBall);
  const rarityOptions = allRarities.map(renderRarity);
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
          <Dialog.Body>
            <Stack gap="5">
              <Stack gap="2">
                <Text fontWeight="bold">Pokébola</Text>
                <RadioCard.Root onValueChange={selectItem} value={String(itemId)}>
                  <Stack gap="2">
                    <RadioCard.Item value="0">
                      <RadioCard.ItemHiddenInput />
                      <RadioCard.ItemControl>
                        <RadioCard.ItemText>Não capturar</RadioCard.ItemText>
                        <RadioCard.ItemIndicator />
                      </RadioCard.ItemControl>
                    </RadioCard.Item>
                    {ballOptions}
                  </Stack>
                </RadioCard.Root>
              </Stack>
              <Stack gap="2">
                <Text fontWeight="bold">Raridades alvo</Text>
                {rarityOptions}
              </Stack>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.ActionTrigger asChild>
              <Button variant="outline">Cancelar</Button>
            </Dialog.ActionTrigger>
            <Button disabled={itemId !== 0 && rarities.length === 0} onClick={save}>
              Salvar
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
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
      setRarities(function update(current): Array<CaptureRarity> {
        return details.checked
          ? [...current, rarity.value]
          : current.filter(function remaining(value): boolean {
              return value !== rarity.value;
            });
      });
    }
    return (
      <Checkbox.Root checked={checked} key={rarity.value} onCheckedChange={change}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>{rarity.label}</Checkbox.Label>
      </Checkbox.Root>
    );
  }
}

function captureItemImageUrl(item: CaptureItem): string {
  return `/assets/items/pokeballs/${item.slug}.png`;
}

function valueForRarity(rarity: Rarity): CaptureRarity {
  return rarity.value;
}
