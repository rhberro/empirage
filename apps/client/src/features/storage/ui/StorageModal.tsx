import { Box } from '@chakra-ui/react';
import type { Creature } from '@creatures/contracts/creature';
import type { TeamSlot } from '@creatures/contracts/player';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { MAX_TEAM_SIZE, useTeam } from '~/entities/team';
import { ReleaseCreatureDialog } from '~/features/release-creature';
import { useSelectionDismiss } from '~/features/storage/model/useSelectionDismiss';
import { useStorage } from '~/features/storage/model/useStorage';
import { useStorageActions } from '~/features/storage/model/useStorageActions';
import { StorageCreaturesSection } from '~/features/storage/ui/StorageCreaturesSection';
import { StorageFooter } from '~/features/storage/ui/StorageFooter';
import {
  FULL_REASON,
  HUNT_REASON,
  STORAGE_HEIGHT,
  STORAGE_WIDTH,
  TITLE,
} from '~/features/storage/ui/storageModal.constants';
import { StorageTeamSection } from '~/features/storage/ui/StorageTeamSection';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '~/shared/ui/modal';

import type { StorageModalProps } from './storageModal.types';

/**
 * The storage: the team on top and the captured creatures below.
 *
 * The reading works from anywhere, hunting or not. The commands that change the team are closed during the hunt, and the order of the team is the order of the entry: the creature in the field is the one in the first slot.
 */
// eslint-disable-next-line max-lines-per-function
export function StorageModal(props: StorageModalProps): ReactElement {
  const { contained = false, isHunting = false, isOpen, onClose, snapshot } = props;
  const fallback = useTeam(undefined, isOpen && snapshot === undefined);
  const team = snapshot ?? fallback;
  const {
    captured,
    clearSelection,
    handleSearchChange,
    isSearching,
    reset: resetStorage,
    search,
    select,
    selectedId,
  } = useStorage(team.storage);
  const isFull = team.team.length >= MAX_TEAM_SIZE;
  const reason = isHunting ? HUNT_REASON : isFull ? FULL_REASON : null;

  const actions = useStorageActions(team);

  function handleModalClose(): void {
    resetStorage();
    onClose();
  }

  return (
    <Modal
      contained={contained}
      height={STORAGE_HEIGHT}
      isOpen={isOpen}
      onClose={handleModalClose}
      width={STORAGE_WIDTH}
    >
      <ModalHeader>{TITLE}</ModalHeader>
      <ModalBody>
        <StorageBody
          activeCreatureId={team.activeCreatureId}
          captured={captured}
          isHunting={isHunting}
          isLoading={team.isLoading}
          isSearching={isSearching}
          onAdd={actions.add}
          onClearSelection={clearSelection}
          onRelease={actions.release.release}
          onRemove={actions.remove}
          onSelect={select}
          reason={reason}
          selectedId={selectedId}
          slots={team.team}
        />
      </ModalBody>
      <ModalFooter>
        <StorageFooter error={team.error} onSearchChange={handleSearchChange} search={search} />
      </ModalFooter>
      <ReleaseCreatureDialog
        creatureName={actions.release.name}
        isOpen={actions.release.isOpen}
        onCancel={actions.release.cancel}
        onConfirm={actions.release.confirm}
      />
    </Modal>
  );
}

type StorageBodyProps = {
  activeCreatureId: string | null;
  captured: Creature[];
  isHunting: boolean;
  isLoading: boolean;
  isSearching: boolean;
  onAdd(creatureId: string): void;
  /** The command that clears the mark, o clique que nao escolhe criatura. */
  onClearSelection(): void;
  /** The action that releases a creature from the storage. */
  onRelease(creature: Creature): void;
  onRemove(creatureId: string): void;
  /** The click on a slot of the grid, that marks the creature as chosen. */
  onSelect(creatureId: string): void;
  reason: string | null;
  /** The creature the player clicked, the one whose slot is marked. */
  selectedId: string | null;
  slots: TeamSlot[];
};

/**
 * The body of the storage: the team on top and the captured creatures below.
 *
 * O popup do time e o da grade sao o mesmo componente, e a loja do popup do
 * sistema guarda um id so: abrir o popup de um slot fecha o do outro, com o
 * mouse e com o toque.
 */
function StorageBody(props: StorageBodyProps): ReactElement {
  const {
    activeCreatureId,
    captured,
    isHunting,
    isLoading,
    isSearching,
    onAdd,
    onClearSelection,
    onRelease,
    onRemove,
    onSelect,
    reason,
    selectedId,
    slots,
  } = props;
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  function clearAllSelection(): void {
    onClearSelection();
    setSelectedTeamId(null);
  }
  const { select, selectTeam } = useSelectionDismiss({
    onClearSelection: clearAllSelection,
    onSelect,
    onSelectTeam: setSelectedTeamId,
  });
  return (
    <Box display="flex" flexDirection="column" gap="4" height="full">
      <StorageTeamSection
        activeCreatureId={activeCreatureId}
        isLocked={isHunting}
        onRemove={onRemove}
        onSelect={selectTeam}
        reason={reason}
        selectedId={selectedTeamId}
        slots={slots}
      />
      <StorageCreaturesSection
        captured={captured}
        isLocked={isHunting}
        isLoading={isLoading}
        isSearching={isSearching}
        onAdd={onAdd}
        onRelease={onRelease}
        onSelect={select}
        selectedId={selectedId}
      />
    </Box>
  );
}
