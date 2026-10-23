import { Box } from '@chakra-ui/react';
import type { StoreItem } from '@creatures/contracts/store';
import type { ReactElement } from 'react';

import { StoreSlot } from '~/features/store/ui/StoreSlot';
import { SlotGrid } from '~/shared/ui/frame';
import { Text } from '~/shared/ui/text';

export type StoreSectionProps = {
  isSelected: (itemId: string) => boolean;
  items: StoreItem[];
  onSelect: (itemId: string) => void;
  title: string;
};

/**
 * A section of the catalog of the store.
 *
 * The grid is the grid of the backpack: the rows are whole and the empty
 * spaces are filled with empty slots.
 */
export function StoreSection(props: StoreSectionProps): ReactElement {
  const { isSelected, items, onSelect, title } = props;
  const cells = items.map(function renderItem(item: StoreItem): ReactElement {
    return <StoreSlotCell isSelected={isSelected} item={item} key={item.id} onSelect={onSelect} />;
  });
  const heading = (
    <Text color="fg.muted" marginBlockEnd="2" variant="label">
      {title}
    </Text>
  );
  return (
    <Box marginBlockEnd="4">
      {heading}
      <SlotGrid>{cells}</SlotGrid>
    </Box>
  );
}

type StoreSlotCellProps = {
  isSelected: (itemId: string) => boolean;
  item: StoreItem;
  onSelect: (itemId: string) => void;
};

/**
 * The slot of one item of the catalog.
 */
function StoreSlotCell(props: StoreSlotCellProps): ReactElement {
  const { isSelected, item, onSelect } = props;
  const selected = isSelected(item.id);
  const onSelectItem = buildSelect(onSelect, item.id);
  return (
    <StoreSlot
      category={item.category}
      description={item.description}
      isSelected={selected}
      name={item.name}
      value={item.price}
      onSelect={onSelectItem}
    />
  );
}

/**
 * The click on the slot of an item of the catalog.
 */
function buildSelect(onSelect: (itemId: string) => void, itemId: string): () => void {
  return function selectItem(): void {
    onSelect(itemId);
  };
}
