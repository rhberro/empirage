import { Box } from '@chakra-ui/react';
import type { Creature } from '@creatures/contracts/creature';
import type { ReactElement } from 'react';

import { StorageCreatureCell } from '~/features/storage/ui/StorageCreatureCell';
import {
  CREATURES_LABEL,
  EMPTY_DESCRIPTION,
  EMPTY_TITLE,
  LOADING_MESSAGE,
} from '~/features/storage/ui/storageModal.constants';
import { PanelState } from '~/shared/ui/empty';
import { SlotGrid } from '~/shared/ui/frame';
import { ScrollArea } from '~/shared/ui/scroll';
import { Text } from '~/shared/ui/text';

type StorageCreaturesSectionProps = {
  captured: Creature[];
  /** Whether the team is closed, which happens during the hunt. */
  isLocked: boolean;
  isLoading: boolean;
  isSearching: boolean;
  onAdd(creatureId: string): void;
  /** The action that releases a creature from the storage. */
  onRelease(creature: Creature): void;
  /** The click on a slot, that marks the creature as chosen. */
  onSelect(creatureId: string): void;
  /** The creature the player clicked, the one whose slot is marked. */
  selectedId: string | null;
};

/**
 * The section of the captured creatures: the grid of the creatures that are
 * not in the team, in the order of the capture.
 */
export function StorageCreaturesSection(props: StorageCreaturesSectionProps): ReactElement {
  const { captured, isLocked, isLoading, isSearching, onAdd, onRelease, onSelect, selectedId } =
    props;
  const label = (
    <Text color="fg.muted" variant="label">
      {CREATURES_LABEL}
    </Text>
  );
  const content = buildCreaturesArea(
    captured,
    isLocked,
    isLoading,
    isSearching,
    onAdd,
    onRelease,
    onSelect,
    selectedId,
  );
  return (
    <Box display="flex" flex="1" flexDirection="column" minH="0">
      {label}
      <Box flex="1" marginBlockStart="2" minH="0">
        {content}
      </Box>
    </Box>
  );
}

/**
 * The area of the grid.
 *
 * The search with no result replaces the grid, and the area loses the scroll:
 * the player reads that the search ran and found nothing, instead of facing an
 * empty grid.
 */
function buildCreaturesArea(
  captured: Creature[],
  isLocked: boolean,
  isLoading: boolean,
  isSearching: boolean,
  onAdd: (creatureId: string) => void,
  onRelease: (creature: Creature) => void,
  onSelect: (creatureId: string) => void,
  selectedId: string | null,
): ReactElement {
  if (isLoading) {
    return <PanelState title={LOADING_MESSAGE} variant="loading" />;
  }
  if (isSearching && captured.length === 0) {
    return <PanelState description={EMPTY_DESCRIPTION} title={EMPTY_TITLE} variant="empty" />;
  }
  const cells = captured.map(renderCell(isLocked, onAdd, onRelease, onSelect, selectedId));
  return (
    <ScrollArea height="full">
      <SlotGrid>{cells}</SlotGrid>
    </ScrollArea>
  );
}

function renderCell(
  isLocked: boolean,
  onAdd: (creatureId: string) => void,
  onRelease: (creature: Creature) => void,
  onSelect: (creatureId: string) => void,
  selectedId: string | null,
): (creature: Creature) => ReactElement {
  return function render(creature: Creature): ReactElement {
    const isSelected = selectedId === creature.id;
    return (
      <StorageCreatureCell
        creature={creature}
        isLocked={isLocked}
        isSelected={isSelected}
        key={creature.id}
        onAdd={onAdd}
        onRelease={onRelease}
        onSelect={onSelect}
      />
    );
  };
}
