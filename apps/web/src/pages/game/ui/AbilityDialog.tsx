import { Button, Dialog, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { HuntAbility, HuntAvailableAbility, HuntCommand } from '../api/hunt-protocol';
import { closeAbilityModal, selectAbilitySlot, useModalStore } from '../model/modal-store';
import { AbilityDetails } from './AbilityDetails';
type AbilityDialogProps = {
  abilities: Array<HuntAvailableAbility>;
  equipped: Array<HuntAbility>;
  level: number;
  onConfigure: (command: HuntCommand) => boolean;
};
type EquippedAbilities = Array<HuntAbility>;
const dialogGridColumns = { base: 1, md: 2 };
function handleOpenChange(details: Dialog.OpenChangeDetails): void {
  if (!details.open) {
    closeAbilityModal();
  }
}
export function AbilityDialog(props: AbilityDialogProps): React.ReactElement {
  const { abilities, equipped, level, onConfigure } = props;
  const slot = useModalStore(selectAbilitySlot);
  const open = slot !== null;
  const selected = findEquippedAbility(equipped, slot);
  const disableClear = selected === undefined;
  function selectAbility(ability: HuntAvailableAbility): void {
    if (slot === null || ability.requiredLevel > level) {
      return;
    }
    const command: HuntCommand = {
      abilityId: ability.id,
      abilitySlot: slot,
      type: 'configure_ability',
      version: 1,
    };
    if (onConfigure(command)) {
      closeAbilityModal();
    }
  }
  function clearSlot(): void {
    if (slot === null) {
      return;
    }
    const command: HuntCommand = {
      abilityId: null,
      abilitySlot: slot,
      type: 'configure_ability',
      version: 1,
    };
    if (onConfigure(command)) {
      closeAbilityModal();
    }
  }
  function renderAbility(ability: HuntAvailableAbility): React.ReactElement {
    const locked = ability.requiredLevel > level;
    const assignedSlot = findAbilitySlot(equipped, ability.id);
    const current = assignedSlot === slot;
    const label = locked
      ? 'Libera no nível ' + ability.requiredLevel
      : current
        ? 'No slot atual'
        : assignedSlot
          ? 'Mover do slot ' + assignedSlot
          : 'Selecionar';
    const opacity = locked ? 0.45 : 1;
    const variant = current ? 'solid' : 'outline';
    function handleClick(): void {
      selectAbility(ability);
    }
    return (
      <Button
        alignItems="stretch"
        disabled={locked}
        h="auto"
        key={ability.id}
        opacity={opacity}
        onClick={handleClick}
        p="3"
        textAlign="left"
        variant={variant}
        whiteSpace="normal"
      >
        <AbilityDetails ability={ability} label={label} />
      </Button>
    );
  }
  const cards = abilities.map(renderAbility);
  const title = slot === null ? 'Habilidades' : 'Habilidade do slot ' + slot;
  return (
    <Dialog.Root lazyMount onOpenChange={handleOpenChange} open={open} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Text color="fg.muted">
                Habilidades bloqueadas aparecem esmaecidas. Ao mover uma habilidade, ela entra no
                cooldown próprio.
              </Text>
              <SimpleGrid columns={dialogGridColumns} gap="3">
                {cards}
              </SimpleGrid>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button disabled={disableClear} onClick={clearSlot} variant="outline">
              Limpar slot
            </Button>
            <Dialog.ActionTrigger asChild>
              <Button variant="outline">Cancelar</Button>
            </Dialog.ActionTrigger>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
function findEquippedAbility(
  abilities: EquippedAbilities,
  slot: number | null,
): HuntAbility | undefined {
  if (slot === null) {
    return undefined;
  }
  for (const ability of abilities) {
    if (ability.slot === slot) {
      return ability;
    }
  }
  return undefined;
}
function findAbilitySlot(abilities: EquippedAbilities, abilityId: number): number | undefined {
  for (const ability of abilities) {
    if (ability.id === abilityId) {
      return ability.slot;
    }
  }
  return undefined;
}
