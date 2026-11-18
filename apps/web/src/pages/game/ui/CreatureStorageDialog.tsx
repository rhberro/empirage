/* eslint-disable max-lines, react/no-multi-comp, oxc/no-optional-chaining, oxsome/no-jsx-inline-computation, oxsome/no-inline-functions-objects-arrays */
import {
  Badge,
  Box,
  Button,
  Dialog,
  Grid,
  HStack,
  Image,
  Menu,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import * as React from 'react';

import type { CollectionCreature } from '../api/game-protocol';
import type { HuntCommand } from '../api/hunt-protocol';
import {
  selectCollectionActiveCreatureId,
  selectCreatureById,
  selectHunt,
  selectPartyIds,
  selectStorageIds,
  selectStoragePage,
  selectStoragePageCount,
  selectStorageTotal,
  useGameStore,
} from '../model/game-store';
import { selectStorageModalState, toggleStorageModal, useModalStore } from '../model/modal-store';

type CreatureStorageDialogProps = {
  onCommand: (command: HuntCommand) => boolean;
};
type CollectionSectionProps = React.PropsWithChildren<{ count: string; label: string }>;
type CollectionCreatureCardProps = {
  active: boolean;
  creatureCount: number;
  creatureId: string;
  isTeamFull: boolean;
  isHunting: boolean;
  onCommand: (command: HuntCommand) => boolean;
  onPartyReorder: (creatureId: string, targetPartySlot: number) => void;
  party: boolean;
};
type CreatureDetailsProps = { creature: CollectionCreature };
type CreatureStatLineProps = { label: string; values: Array<number> };
type StoragePaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function CreatureStorageDialog(props: CreatureStorageDialogProps): React.ReactElement {
  const { onCommand } = props;
  const collectionActiveCreatureId = useGameStore(selectCollectionActiveCreatureId);
  const hunt = useGameStore(selectHunt);
  const partyIds = useGameStore(selectPartyIds);
  const storageIds = useGameStore(selectStorageIds);
  const storagePage = useGameStore(selectStoragePage);
  const storagePageCount = useGameStore(selectStoragePageCount);
  const storageTotal = useGameStore(selectStorageTotal);
  const activeCreatureId = hunt?.activeCreatureId ?? collectionActiveCreatureId;
  const isHunting = hunt !== null;
  const open = useModalStore(selectStorageModalState);
  const isTeamFull = partyIds.length >= 6;
  const creatureCount = partyIds.length + storageTotal;

  function requestStoragePage(page: number): void {
    onCommand({ storagePage: page, type: 'request_creature_storage', version: 1 });
  }
  function reorderParty(creatureId: string, targetPartySlot: number): void {
    if (isHunting) {
      return;
    }
    onCommand({ creatureId, targetPartySlot, type: 'reorder_party_creature', version: 1 });
  }

  return (
    <Dialog.Root lazyMount onOpenChange={toggleStorageModal} open={open} size="xl" unmountOnExit>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="calc(100dvh - 8)" overflow="hidden">
          <Dialog.Header>
            <Text color="brand.solid" fontSize="xs" fontWeight="bold" letterSpacing="widest">
              ARMAZENAMENTO
            </Text>
            <Dialog.Title>Coleção de criaturas</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body overflowY="auto">
            <Stack gap="6">
              <CollectionSection count={`${partyIds.length}/6`} label="Time atual">
                <HStack align="start" gap="3" overflowX="auto" pb="1">
                  {partyIds.map(function renderPartyCard(creatureId): React.ReactElement {
                    return (
                      <CollectionCreatureCard
                        active={creatureId === activeCreatureId}
                        creatureCount={creatureCount}
                        creatureId={creatureId}
                        isTeamFull={isTeamFull}
                        isHunting={isHunting}
                        key={creatureId}
                        onCommand={onCommand}
                        onPartyReorder={reorderParty}
                        party
                      />
                    );
                  })}
                </HStack>
              </CollectionSection>
              <CollectionSection count={String(storageTotal)} label="Armazenamento">
                <Grid gap="3" templateColumns="repeat(auto-fill, minmax(7rem, 1fr))">
                  {storageIds.length === 0 ? <StorageEmpty /> : null}
                  {storageIds.map(function renderStorageCard(creatureId): React.ReactElement {
                    return (
                      <CollectionCreatureCard
                        active={false}
                        creatureCount={creatureCount}
                        creatureId={creatureId}
                        isTeamFull={isTeamFull}
                        isHunting={isHunting}
                        key={creatureId}
                        onCommand={onCommand}
                        onPartyReorder={reorderParty}
                        party={false}
                      />
                    );
                  })}
                </Grid>
                <StoragePagination
                  onPageChange={requestStoragePage}
                  page={storagePage}
                  pageCount={storagePageCount}
                />
              </CollectionSection>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.ActionTrigger asChild>
              <Button>Fechar</Button>
            </Dialog.ActionTrigger>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

function StoragePagination(props: StoragePaginationProps): React.ReactElement | null {
  const { onPageChange, page, pageCount } = props;
  if (pageCount <= 1) {
    return null;
  }
  function showPreviousPage(): void {
    onPageChange(page - 1);
  }
  function showNextPage(): void {
    onPageChange(page + 1);
  }
  return (
    <HStack justify="space-between">
      <Button disabled={page === 1} onClick={showPreviousPage} size="sm" variant="outline">
        Anterior
      </Button>
      <Text color="fg.muted" fontSize="xs">
        Página {page} de {pageCount}
      </Text>
      <Button disabled={page === pageCount} onClick={showNextPage} size="sm" variant="outline">
        Próxima
      </Button>
    </HStack>
  );
}

function CollectionSection(props: CollectionSectionProps): React.ReactElement {
  const { children, count, label } = props;
  return (
    <Stack gap="3">
      <HStack justify="space-between">
        <Text fontWeight="bold">{label}</Text>
        <Badge colorPalette="blue">{count}</Badge>
      </HStack>
      {children}
    </Stack>
  );
}

function StorageEmpty(): React.ReactElement {
  return (
    <Box
      bg="surface.sunken"
      borderColor="border.default"
      borderWidth="1px"
      gridColumn="1 / -1"
      p="6"
    >
      <Text color="fg.muted" textAlign="center">
        Nenhuma criatura armazenada.
      </Text>
    </Box>
  );
}

function CollectionCreatureCard(props: CollectionCreatureCardProps): React.ReactElement | null {
  const {
    active,
    creatureCount,
    creatureId,
    isHunting,
    isTeamFull,
    onCommand,
    onPartyReorder,
    party,
  } = props;
  const creatureSelector = React.useMemo(
    function createCreatureSelector() {
      return selectCreatureById(creatureId);
    },
    [creatureId],
  );
  const creature = useGameStore(creatureSelector);
  const [releaseConfirmationOpen, setReleaseConfirmationOpen] = React.useState(false);
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
    onCommand({ creatureId: creature.id, type, version: 1 });
  }

  function activateCreature(): void {
    onCommand({ creatureId: creature.id, type: 'switch_active_creature', version: 1 });
  }

  function openReleaseConfirmation(): void {
    setReleaseConfirmationOpen(true);
  }

  function closeReleaseConfirmation(): void {
    setReleaseConfirmationOpen(false);
  }

  function releaseCreature(): void {
    if (!canRelease) {
      return;
    }
    onCommand({ creatureId: creature.id, type: 'release_creature', version: 1 });
    closeReleaseConfirmation();
  }

  function moveToFirstPosition(): void {
    moveToPosition(1);
  }

  function moveToSecondPosition(): void {
    moveToPosition(2);
  }

  function moveToThirdPosition(): void {
    moveToPosition(3);
  }

  function moveToFourthPosition(): void {
    moveToPosition(4);
  }

  function moveToFifthPosition(): void {
    moveToPosition(5);
  }

  function moveToSixthPosition(): void {
    moveToPosition(6);
  }

  function moveToPosition(targetPartySlot: number): void {
    onPartyReorder(creature.id, targetPartySlot);
  }

  const menu = (
    <Menu.Root positioning={{ placement: 'bottom-start', strategy: 'fixed' }}>
      <Menu.Trigger asChild>
        <Button
          aria-label={`Opções de ${creature.species.name}`}
          bg="surface.panel"
          borderColor={active ? 'brand.solid' : 'border.default'}
          borderWidth="1px"
          h="auto"
          minW={width}
          p="2"
          variant="ghost"
        >
          <Stack align="center" gap="1" w="full">
            <Image
              alt={creature.species.name}
              boxSize={active ? '14' : '11'}
              imageRendering="pixelated"
              src={image}
            />
            <Text fontSize="xs" lineClamp="1">
              {creature.species.name}
            </Text>
            <Text color="fg.muted" fontSize="2xs">
              Nv. {creature.level}
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
            {party ? (
              <Menu.Item
                disabled={active}
                onClick={activateCreature}
                value={'activate-' + creature.id}
              >
                {active ? 'Criatura ativa' : 'Tornar ativa'}
              </Menu.Item>
            ) : null}
            <Menu.Item disabled={actionDisabled} onClick={moveCreature} value={creature.id}>
              {action}
            </Menu.Item>
            {party ? (
              <>
                <Menu.Separator />
                <Menu.Item
                  disabled={isHunting}
                  onClick={moveToFirstPosition}
                  value={`position-1-${creature.id}`}
                >
                  Mover para posição 1
                </Menu.Item>
                <Menu.Item
                  disabled={isHunting}
                  onClick={moveToSecondPosition}
                  value={`position-2-${creature.id}`}
                >
                  Mover para posição 2
                </Menu.Item>
                <Menu.Item
                  disabled={isHunting}
                  onClick={moveToThirdPosition}
                  value={`position-3-${creature.id}`}
                >
                  Mover para posição 3
                </Menu.Item>
                <Menu.Item
                  disabled={isHunting}
                  onClick={moveToFourthPosition}
                  value={`position-4-${creature.id}`}
                >
                  Mover para posição 4
                </Menu.Item>
                <Menu.Item
                  disabled={isHunting}
                  onClick={moveToFifthPosition}
                  value={`position-5-${creature.id}`}
                >
                  Mover para posição 5
                </Menu.Item>
                <Menu.Item
                  disabled={isHunting}
                  onClick={moveToSixthPosition}
                  value={`position-6-${creature.id}`}
                >
                  Mover para posição 6
                </Menu.Item>
              </>
            ) : null}
            <Menu.Item
              disabled={!canRelease}
              onClick={openReleaseConfirmation}
              value={`release-${creature.id}`}
            >
              Soltar criatura
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
  return (
    <>
      {menu}
      <Dialog.Root onOpenChange={closeReleaseConfirmation} open={releaseConfirmationOpen}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Soltar criatura?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                {creature.species.name} será removida permanentemente. Esta ação não pode ser
                desfeita.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={closeReleaseConfirmation} variant="outline">
                Não
              </Button>
              <Button colorPalette="red" onClick={releaseCreature}>
                Sim, soltar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}

function CreatureDetails(props: CreatureDetailsProps): React.ReactElement {
  const { creature } = props;
  const capturedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
    new Date(creature.capturedAt),
  );
  const base = baseStatsFor(creature);
  const ivs = ivsFor(creature);
  const current = calculateStats(creature, base, ivs);

  return (
    <Stack gap="2">
      <HStack>
        <Text fontWeight="bold">{creature.species.name}</Text>
        <Badge>{rarityLabel(rarityForCreature(creature))}</Badge>
      </HStack>
      <Text color="fg.muted" fontSize="xs">
        Nv. {creature.level} · EXP {creature.experience}
      </Text>
      <Text fontSize="xs">{creature.species.description}</Text>
      <Text color="fg.muted" fontSize="xs">
        {creature.elements.join(' · ')}
      </Text>
      <CreatureStatLine label="Base" values={base} />
      <CreatureStatLine label="IV" values={ivs} />
      <CreatureStatLine label="Atual" values={current} />
      <Text color="fg.muted" fontSize="xs">
        Capturada em {capturedAt}
      </Text>
    </Stack>
  );
}

function CreatureStatLine(props: CreatureStatLineProps): React.ReactElement {
  const { label, values } = props;
  const valueLabel = `HP ${values[0]} · ATQ ${values[1]} · DEF ${values[2]} · SpA ${values[3]} · SpD ${values[4]} · VEL ${values[5]}`;
  return (
    <Text fontSize="2xs">
      {label}: {valueLabel}
    </Text>
  );
}

function creatureIconUrl(creature: CollectionCreature): string {
  return `/assets/creatures/icons/${creature.species.id}.png`;
}

function baseStatsFor(creature: CollectionCreature): Array<number> {
  const { species } = creature;
  return [
    species.base_hp,
    species.base_attack,
    species.base_defense,
    species.base_special_attack,
    species.base_special_defense,
    species.base_speed,
  ];
}

function ivsFor(creature: CollectionCreature): Array<number> {
  return [
    creature.ivHealth,
    creature.ivAttack,
    creature.ivDefense,
    creature.ivSpecialAttack,
    creature.ivSpecialDefense,
    creature.ivSpeed,
  ];
}

function calculateStats(
  creature: CollectionCreature,
  base: Array<number>,
  ivs: Array<number>,
): Array<number> {
  return base.map(function calculateStat(value: number, index: number): number {
    const scaled = Math.floor(((value * 2 + ivs[index]) * creature.level) / 100);
    return index === 0 ? scaled + creature.level + 10 : scaled + 5;
  });
}

function rarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    common: 'Comum',
    epic: 'Épica',
    legendary: 'Lendária',
    rare: 'Rara',
    uncommon: 'Incomum',
  };
  return labels[rarity] ?? rarity;
}

function rarityForCreature(creature: CollectionCreature): string {
  const total =
    creature.ivHealth +
    creature.ivAttack +
    creature.ivDefense +
    creature.ivSpecialAttack +
    creature.ivSpecialDefense +
    creature.ivSpeed;
  if (total <= 37) {
    return 'common';
  }
  if (total <= 74) {
    return 'uncommon';
  }
  if (total <= 111) {
    return 'rare';
  }
  return total <= 148 ? 'epic' : 'legendary';
}
