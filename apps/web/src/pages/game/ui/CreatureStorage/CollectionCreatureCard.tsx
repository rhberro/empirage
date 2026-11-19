import { Box, Button, Image, Menu, Portal, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';
import type { HuntCommand } from '../../api/hunt-protocol';
import { selectCreatureById, useGameStore } from '../../model/game-store';
import { CreatureDetails } from './CreatureDetails';
import { creatureIconUrl } from './storage-creature-helpers';

type CollectionCreatureCardProps = {
  active: boolean;
  creatureCount: number;
  creatureId: string;
  isTeamFull: boolean;
  isHunting: boolean;
  onCommand: (command: HuntCommand) => boolean;
  onOpenRelease: (creature: CollectionCreature) => void;
  onPartyReorder: (creatureId: string, targetPartySlot: number) => void;
  party: boolean;
};

const menuPositioning = {
  placement: 'bottom-start' as const,
  strategy: 'fixed' as const,
};

export const CollectionCreatureCard = React.memo(CollectionCreatureCardComponent);

function CollectionCreatureCardComponent(
  props: CollectionCreatureCardProps,
): React.ReactElement | null {
  const {
    active,
    creatureCount,
    creatureId,
    isHunting,
    isTeamFull,
    onCommand,
    onOpenRelease,
    onPartyReorder,
    party,
  } = props;

  function createSelector(): ReturnType<typeof selectCreatureById> {
    return selectCreatureById(creatureId);
  }
  const creatureSelector = React.useMemo(createSelector, [creatureId]);
  const creature = useGameStore(creatureSelector);

  if (!creature) {
    return null;
  }

  const image = creatureIconUrl(creature);
  const width = active ? '8rem' : party ? '6.5rem' : 'full';
  const action = party ? 'Remover do time' : 'Adicionar ao time';
  const actionDisabled = isHunting || (!party && isTeamFull);
  const canRelease = !isHunting && !active && creatureCount > 1;

  function moveCreature(): void {
    if (isHunting) {
      return;
    }
    const type = party ? 'move_creature_to_storage' : 'move_creature_to_party';
    const command: HuntCommand = { creatureId: creature.id, type, version: 1 };
    onCommand(command);
  }

  function activateCreature(): void {
    const command: HuntCommand = {
      creatureId: creature.id,
      type: 'switch_active_creature',
      version: 1,
    };
    onCommand(command);
  }

  function handleReleaseClick(): void {
    onOpenRelease(creature);
  }

  function moveToPosition(targetPartySlot: number): void {
    onPartyReorder(creature.id, targetPartySlot);
  }

  const moveToPos1 = moveToPosition.bind(null, 1);
  const moveToPos2 = moveToPosition.bind(null, 2);
  const moveToPos3 = moveToPosition.bind(null, 3);
  const moveToPos4 = moveToPosition.bind(null, 4);
  const moveToPos5 = moveToPosition.bind(null, 5);
  const moveToPos6 = moveToPosition.bind(null, 6);

  const ariaLabel = `Opções de ${creature.species.name}`;
  const borderColor = active ? 'brand.solid' : 'border.default';
  const boxSize = active ? '14' : '11';
  const levelText = `Nv. ${creature.level}`;
  const activateValue = `activate-${creature.id}`;
  const releaseValue = `release-${creature.id}`;
  const activeLabel = active ? 'Criatura ativa' : 'Tornar ativa';

  const activateMenuItem = party ? (
    <Menu.Item disabled={active} onClick={activateCreature} value={activateValue}>
      {activeLabel}
    </Menu.Item>
  ) : null;

  const reorderItemGroup = party ? (
    <>
      <Menu.Separator />
      <Menu.ItemGroup title="Mover para posição">
        <Menu.Item onClick={moveToPos1} value="pos-1">
          Posição 1 (Ativa)
        </Menu.Item>
        <Menu.Item onClick={moveToPos2} value="pos-2">
          Posição 2
        </Menu.Item>
        <Menu.Item onClick={moveToPos3} value="pos-3">
          Posição 3
        </Menu.Item>
        <Menu.Item onClick={moveToPos4} value="pos-4">
          Posição 4
        </Menu.Item>
        <Menu.Item onClick={moveToPos5} value="pos-5">
          Posição 5
        </Menu.Item>
        <Menu.Item onClick={moveToPos6} value="pos-6">
          Posição 6
        </Menu.Item>
      </Menu.ItemGroup>
    </>
  ) : null;

  const releaseMenuItem = canRelease ? (
    <>
      <Menu.Separator />
      <Menu.Item color="fg.error" onClick={handleReleaseClick} value={releaseValue}>
        Soltar criatura
      </Menu.Item>
    </>
  ) : null;

  return (
    <Menu.Root lazyMount positioning={menuPositioning} unmountOnExit>
      <Menu.Trigger asChild>
        <Button
          aria-label={ariaLabel}
          bg="surface.panel"
          borderColor={borderColor}
          borderWidth="1px"
          h="auto"
          minW={width}
          p="2"
          variant="ghost"
        >
          <Stack align="center" gap="1" w="full">
            <Image
              alt={creature.species.name}
              boxSize={boxSize}
              imageRendering="pixelated"
              src={image}
            />
            <Text fontSize="xs" lineClamp="1">
              {creature.species.name}
            </Text>
            <Text color="fg.muted" fontSize="2xs">
              {levelText}
            </Text>
          </Stack>
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Box maxW="18rem" p="2">
              <CreatureDetails creature={creature} />
            </Box>
            <Menu.Separator />
            {activateMenuItem}
            <Menu.Item disabled={actionDisabled} onClick={moveCreature} value={creature.id}>
              {action}
            </Menu.Item>
            {reorderItemGroup}
            {releaseMenuItem}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
