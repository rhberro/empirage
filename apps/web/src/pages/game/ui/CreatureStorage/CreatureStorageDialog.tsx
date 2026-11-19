import { Button, Dialog, HStack, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';
import type { HuntCommand } from '../../api/hunt-protocol';
import {
  selectCollectionActiveCreatureId,
  selectHunt,
  selectPartyIds,
  selectStorageIds,
  selectStoragePage,
  selectStoragePageCount,
  selectStorageTotal,
  switchToStoragePage,
  useGameStore,
} from '../../model/game-store';
import {
  selectStorageModalState,
  toggleStorageModal,
  useModalStore,
} from '../../model/modal-store';
import { CollectionCreatureCard } from './CollectionCreatureCard';
import { CollectionSection } from './CollectionSection';
import { ReleaseConfirmationDialog } from './ReleaseConfirmationDialog';
import { StorageSection } from './StorageSection';

type CreatureStorageDialogProps = {
  onCommand: (command: HuntCommand) => boolean;
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
  const activeCreatureId = hunt ? hunt.activeCreatureId : collectionActiveCreatureId;
  const isHunting = hunt !== null;
  const open = useModalStore(selectStorageModalState);
  const isTeamFull = partyIds.length >= 6;
  const creatureCount = partyIds.length + storageTotal;

  const [targetPage, setTargetPage] = React.useState<number | null>(null);
  const [creatureToRelease, setCreatureToRelease] = React.useState<CollectionCreature | null>(null);
  const loading = targetPage !== null && targetPage !== storagePage;

  function requestStoragePage(page: number): void {
    const hit = switchToStoragePage(page);
    if (!hit) {
      setTargetPage(page);
    }
    const command: HuntCommand = {
      storagePage: page,
      type: 'request_creature_storage',
      version: 1,
    };
    onCommand(command);
  }

  function reorderParty(creatureId: string, targetPartySlot: number): void {
    if (isHunting) {
      return;
    }
    const command: HuntCommand = {
      creatureId,
      targetPartySlot,
      type: 'reorder_party_creature',
      version: 1,
    };
    onCommand(command);
  }

  function handleOpenRelease(creature: CollectionCreature): void {
    setCreatureToRelease(creature);
  }

  function handleCancelRelease(): void {
    setCreatureToRelease(null);
  }

  function handleConfirmRelease(): void {
    if (!creatureToRelease) {
      return;
    }
    const command: HuntCommand = {
      creatureId: creatureToRelease.id,
      type: 'release_creature',
      version: 1,
    };
    onCommand(command);
    setCreatureToRelease(null);
  }

  function renderPartyCard(creatureId: string): React.ReactElement {
    const isActive = creatureId === activeCreatureId;
    return (
      <CollectionCreatureCard
        active={isActive}
        creatureCount={creatureCount}
        creatureId={creatureId}
        isHunting={isHunting}
        isTeamFull={isTeamFull}
        key={creatureId}
        onCommand={onCommand}
        onOpenRelease={handleOpenRelease}
        onPartyReorder={reorderParty}
        party
      />
    );
  }

  const partyCards = partyIds.map(renderPartyCard);
  const partyCountLabel = `${partyIds.length}/6`;

  return (
    <>
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
                <CollectionSection count={partyCountLabel} label="Time atual">
                  <HStack align="start" gap="3" overflowX="auto" pb="1">
                    {partyCards}
                  </HStack>
                </CollectionSection>
                <StorageSection
                  creatureCount={creatureCount}
                  isHunting={isHunting}
                  isTeamFull={isTeamFull}
                  loading={loading}
                  onCommand={onCommand}
                  onOpenRelease={handleOpenRelease}
                  onPageChange={requestStoragePage}
                  onPartyReorder={reorderParty}
                  storageIds={storageIds}
                  storagePage={storagePage}
                  storagePageCount={storagePageCount}
                  storageTotal={storageTotal}
                />
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

      <ReleaseConfirmationDialog
        creature={creatureToRelease}
        onCancel={handleCancelRelease}
        onConfirm={handleConfirmRelease}
      />
    </>
  );
}
