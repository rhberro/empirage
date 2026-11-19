import { Grid } from '@chakra-ui/react';
import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';
import type { HuntCommand } from '../../api/hunt-protocol';
import { CollectionCreatureCard } from './CollectionCreatureCard';
import { CollectionSection } from './CollectionSection';
import { StorageEmpty } from './StorageEmpty';
import { StoragePagination } from './StoragePagination';

type StorageSectionProps = {
  creatureCount: number;
  isHunting: boolean;
  isTeamFull: boolean;
  loading: boolean;
  onCommand: (command: HuntCommand) => boolean;
  onOpenRelease: (creature: CollectionCreature) => void;
  onPageChange: (page: number) => void;
  onPartyReorder: (creatureId: string, targetPartySlot: number) => void;
  storageIds: Array<string>;
  storagePage: number;
  storagePageCount: number;
  storageTotal: number;
};

export function StorageSection(props: StorageSectionProps): React.ReactElement {
  const {
    creatureCount,
    isHunting,
    isTeamFull,
    loading,
    onCommand,
    onOpenRelease,
    onPageChange,
    onPartyReorder,
    storageIds,
    storagePage,
    storagePageCount,
    storageTotal,
  } = props;

  function renderStorageCard(creatureId: string): React.ReactElement {
    return (
      <CollectionCreatureCard
        active={false}
        creatureCount={creatureCount}
        creatureId={creatureId}
        isHunting={isHunting}
        isTeamFull={isTeamFull}
        key={creatureId}
        onCommand={onCommand}
        onOpenRelease={onOpenRelease}
        onPartyReorder={onPartyReorder}
        party={false}
      />
    );
  }

  const storageCards = storageIds.map(renderStorageCard);
  const emptyStorageIndicator = storageIds.length === 0 ? <StorageEmpty /> : null;
  const storageCountLabel = String(storageTotal);

  return (
    <CollectionSection count={storageCountLabel} label="Armazenamento">
      <Grid gap="3" templateColumns="repeat(auto-fill, minmax(7rem, 1fr))">
        {emptyStorageIndicator}
        {storageCards}
      </Grid>
      <StoragePagination
        loading={loading}
        onPageChange={onPageChange}
        page={storagePage}
        pageCount={storagePageCount}
      />
    </CollectionSection>
  );
}
