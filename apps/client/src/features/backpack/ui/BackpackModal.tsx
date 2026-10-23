/* eslint-disable max-lines */
/* eslint-disable react-hooks/set-state-in-effect */
import { Box } from '@chakra-ui/react';
import type { InventoryItem, ItemCategory } from '@creatures/contracts/inventory';
import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { SlotGridArea, useTeam } from '~/entities/team';
import {
  BAG_FILTERS,
  filterBackpackItems,
  useBackpack,
} from '~/features/backpack/model/useBackpack';
import type { BagFilter } from '~/features/backpack/model/useBackpack';
import { useDestroyItem } from '~/features/backpack/model/useDestroyItem';
import { DestroyItemDialog } from '~/features/backpack/ui/DestroyItemDialog';
import { DIVIDER_BOTTOM } from '~/shared/theme';
import { NativeButton } from '~/shared/ui/button';
import { PanelState } from '~/shared/ui/empty';
import { TextField } from '~/shared/ui/field';
import { Slot, SLOT_SIZE } from '~/shared/ui/frame';
import { IconChest, IconPotion, IconPrism } from '~/shared/ui/icon';
import { ContextMenu } from '~/shared/ui/menu';
import type { ContextMenuItem } from '~/shared/ui/menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '~/shared/ui/modal';
import { Popup, useHasHoverCapability, useSlotTooltip } from '~/shared/ui/popup';
import { ScrollArea } from '~/shared/ui/scroll';
import { Tab, TabBar, TabPanel, Tabs } from '~/shared/ui/tab';
import { Text } from '~/shared/ui/text';

import type { BackpackModalProps } from './backpackModal.types';

const TITLE = 'Mochila';
const SEARCH_PLACEHOLDER = 'Buscar na mochila';
const EMPTY_TITLE = 'Nenhum item encontrado';
const EMPTY_DESCRIPTION = 'Nada na mochila combina com a busca.';
const LOADING_MESSAGE = 'Carregando...';
const BAG_WIDTH = '45rem';
const BAG_HEIGHT = '35rem';
const SEARCH_WIDTH = '15rem';
const ICON_SIZE = '1.5rem';
const DESTROY_LABEL = 'Destruir item';

const ITEM_CATEGORY_COLORS: Record<ItemCategory, string> = {
  consumable: 'element.plant',
  device: 'element.water',
  material: 'accent.gold',
};

const ITEM_CATEGORY_ICONS: Record<ItemCategory, (props: { size?: string }) => ReactElement> = {
  consumable: IconPotion,
  device: IconPrism,
  material: IconChest,
};

// eslint-disable-next-line max-lines-per-function
export function BackpackModal(props: BackpackModalProps): ReactElement {
  const { contained = false, isOpen, onClose, snapshot } = props;
  const fallback = useTeam(undefined, isOpen && snapshot === undefined);
  const team = snapshot ?? fallback;
  const { filter, handleSearchChange, isSearching, reset, search, setFilter } = useBackpack();
  const { destroyItem, isDestroying, error: destroyError } = useDestroyItem();
  useResetOnOpen(isOpen, reset);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(function clearSelectedOnOutsideClick(): () => void {
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (
        target instanceof Node &&
        typeof (target as { closest?: (s: string) => unknown }).closest === 'function' &&
        (target as unknown as { closest(s: string): unknown }).closest('[data-slot]') !== null
      ) {
        return;
      }
      setSelectedId(null);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return function remove(): void {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);
  const [destroyTarget, setDestroyTarget] = useState<{ itemId: string; name: string } | null>(null);
  const [confirmRequested, setConfirmRequested] = useState<boolean>(false);

  function handleModalClose(): void {
    setSelectedId(null);
    setDestroyTarget(null);
    setConfirmRequested(false);
    onClose();
  }

  // eslint-disable-next-line react(set-state-in-effect)
  useEffect(
    function closeOnDestroyResult(): void {
      if (confirmRequested && !isDestroying) {
        if (destroyError === null) {
          // eslint-disable-next-line react(set-state-in-effect)
          setDestroyTarget(null);
        }
        // eslint-disable-next-line react(set-state-in-effect)
        setConfirmRequested(false);
      }
    },
    [confirmRequested, isDestroying, destroyError],
  );

  function handleRequestDestroy(item: InventoryItem): void {
    if (
      !team.backpack.some(function present(candidate: InventoryItem): boolean {
        return candidate.itemId === item.itemId;
      })
    ) {
      return;
    }
    setDestroyTarget({ itemId: item.itemId, name: item.name });
  }

  function handleDestroyConfirm(): void {
    if (destroyTarget === null) {
      return;
    }
    if (
      !team.backpack.some(function present(candidate: InventoryItem): boolean {
        return candidate.itemId === destroyTarget.itemId;
      })
    ) {
      setDestroyTarget(null);
      return;
    }
    setConfirmRequested(true);
    destroyItem(destroyTarget.itemId);
  }

  function handleDestroyCancel(): void {
    if (isDestroying) {
      return;
    }
    setDestroyTarget(null);
    setConfirmRequested(false);
  }

  const isDestroyOpen = destroyTarget !== null;
  const destroyName = destroyTarget === null ? '' : destroyTarget.name;
  const filterTabs = BAG_FILTERS.map(renderFilter);
  const panels = BAG_FILTERS.map(function renderTab(filterOption: BagFilter): ReactElement {
    return (
      <TabPanel key={filterOption} value={filterOption}>
        <BackpackPanel
          backpack={team.backpack}
          filterOption={filterOption}
          isSearching={isSearching}
          onRequestDestroy={handleRequestDestroy}
          onSelect={setSelectedId}
          search={search}
          selectedId={selectedId}
        />
      </TabPanel>
    );
  });
  const body = team.isLoading ? <PanelState title={LOADING_MESSAGE} variant="loading" /> : panels;
  const handleFilterChange = buildFilterChange(setFilter);
  const tabs = (
    <Tabs onValueChange={handleFilterChange} value={filter}>
      <ModalHeader>{TITLE}</ModalHeader>
      <Box css={DIVIDER_BOTTOM} paddingBlock="2" paddingInline="4">
        <TabBar>{filterTabs}</TabBar>
      </Box>
      <ModalBody>{body}</ModalBody>
    </Tabs>
  );
  const footer = (
    <BackpackFooter error={team.error} onSearchChange={handleSearchChange} search={search} />
  );
  return (
    <>
      <Modal
        contained={contained}
        height={BAG_HEIGHT}
        isOpen={isOpen}
        onClose={handleModalClose}
        width={BAG_WIDTH}
      >
        {tabs}
        <ModalFooter>{footer}</ModalFooter>
      </Modal>
      <DestroyItemDialog
        contained={contained}
        error={destroyError}
        isOpen={isDestroyOpen}
        isDestroying={isDestroying}
        itemName={destroyName}
        onCancel={handleDestroyCancel}
        onConfirm={handleDestroyConfirm}
      />
    </>
  );
}

type BackpackFooterProps = {
  error: string | null;
  onSearchChange(event: ChangeEvent<HTMLInputElement>): void;
  search: string;
};

function useResetOnOpen(isOpen: boolean, reset: () => void): void {
  const wasOpen = useRef<boolean>(false);
  useEffect(
    function resetOnOpen(): void {
      if (isOpen && !wasOpen.current) {
        reset();
      }
      wasOpen.current = isOpen;
    },
    [isOpen, reset],
  );
}

function BackpackFooter(props: BackpackFooterProps): ReactElement {
  const { error, onSearchChange, search } = props;
  const errorMessage =
    error === null ? null : (
      <Text color="fg.error" variant="meta">
        {error}
      </Text>
    );
  const searchField = (
    <TextField
      aria-label={SEARCH_PLACEHOLDER}
      clearable
      name="buscar-mochila"
      onChange={onSearchChange}
      placeholder={SEARCH_PLACEHOLDER}
      value={search}
    />
  );
  return (
    <Box alignItems="center" display="flex" gap="2" width="full">
      {errorMessage}
      <Box marginInlineStart="auto" maxW={SEARCH_WIDTH} width="full">
        {searchField}
      </Box>
    </Box>
  );
}

function renderFilter(filter: BagFilter): ReactElement {
  return (
    <Tab key={filter} value={filter}>
      {filter}
    </Tab>
  );
}

function buildFilterChange(setFilter: (filter: BagFilter) => void): (value: string) => void {
  return function handleChange(value: string): void {
    setFilter(value as BagFilter);
  };
}

type BackpackPanelProps = {
  backpack: InventoryItem[];
  filterOption: BagFilter;
  isSearching: boolean;
  onRequestDestroy(item: InventoryItem): void;
  search: string;
  selectedId: string | null;
  onSelect(itemId: string): void;
};

function BackpackPanel(props: BackpackPanelProps): ReactElement {
  const { backpack, filterOption, isSearching, onRequestDestroy, onSelect, search, selectedId } =
    props;
  const items = filterBackpackItems(backpack, filterOption, search);
  if (isSearching && items.length === 0) {
    return <PanelState description={EMPTY_DESCRIPTION} title={EMPTY_TITLE} variant="empty" />;
  }
  const cells = items.map(function renderItem(item: InventoryItem): ReactElement {
    const isSelected = selectedId === item.itemId;
    return (
      <ItemSlot
        isSelected={isSelected}
        key={item.itemId}
        item={item}
        onRequestDestroy={onRequestDestroy}
        onSelect={onSelect}
      />
    );
  });
  return (
    <ScrollArea height="full">
      <SlotGridArea>{cells}</SlotGridArea>
    </ScrollArea>
  );
}

/**
 * The slot of an item, as the trigger of its menu.
 *
 * The hover shows the popup with the name and the quantity, and the click —
 * left or right of the mouse — opens the menu with the actions. While the
 * menu is open, the popup is held shut: a tooltip that survives the menu
 * competes with it for the same pointer. The slot stays marked while the
 * menu lives, and the mark goes away with it: the mark follows the menu,
 * not the hover.
 *
 * On the touch, the tap shows the popup and marks the slot, and the second
 * tap on the marked slot opens the menu; a tap outside hides the popup.
 */
function ItemSlot(props: ItemSlotProps): ReactElement {
  const { isSelected, item, onRequestDestroy, onSelect } = props;
  const hasHover = useHasHoverCapability();
  const slotTooltip = useSlotTooltip(hasHover);
  const content = buildItemPopupContent(item);
  const trigger = buildItemTrigger(item, isSelected, onSelect);
  const menuItems: ContextMenuItem[] = [
    {
      label: DESTROY_LABEL,
      onSelect: function destroy(): void {
        onRequestDestroy(item);
      },
      tone: 'danger',
    },
  ];
  const touchTapToggle = hasHover ? undefined : slotTooltip.handleTapToggle;
  const tapGate = buildTapGate(isSelected);
  const wrappedTrigger = (
    <Popup content={content} disabled={slotTooltip.menuOpen} open={slotTooltip.open}>
      {trigger}
    </Popup>
  );
  return (
    <ContextMenu items={menuItems} onOpenChange={slotTooltip.setMenuOpen} shouldOpenOnTap={tapGate}>
      <Box
        display="contents"
        onClick={touchTapToggle}
        onPointerDown={slotTooltip.handlePointerDown}
        onPointerEnter={slotTooltip.handlePointerEnter}
        onPointerLeave={slotTooltip.handlePointerLeave}
        ref={slotTooltip.triggerRef}
      >
        {wrappedTrigger}
      </Box>
    </ContextMenu>
  );
}

type ItemSlotProps = {
  isSelected: boolean;
  item: InventoryItem;
  onRequestDestroy(item: InventoryItem): void;
  onSelect(itemId: string): void;
};

/**
 * The gate of the tap: the marked slot answers the second tap with the menu,
 * an unmarked one with the tooltip.
 */
function buildTapGate(marked: boolean): () => boolean {
  return function isSlotMarked(): boolean {
    return marked;
  };
}

function buildItemPopupContent(item: InventoryItem): ReactElement {
  const quantity = `Quantidade: ${item.quantity}`;
  return (
    <Box display="flex" flexDirection="column" gap="1">
      <Text variant="name">{item.name}</Text>
      <Text color="fg.muted" variant="meta">
        {quantity}
      </Text>
    </Box>
  );
}

function buildItemTrigger(
  item: InventoryItem,
  selected: boolean,
  onSelect: (itemId: string) => void,
): ReactElement {
  const glyph = <ItemGlyph category={item.category} quantity={item.quantity} />;
  const label = `${item.name} (${item.quantity})`;
  const handleClick = buildItemClick(onSelect, item.itemId);
  return (
    <NativeButton
      aria-label={label}
      data-slot="true"
      display="block"
      onClick={handleClick}
      position="relative"
      width={SLOT_SIZE}
    >
      <Slot selected={selected}>{glyph}</Slot>
    </NativeButton>
  );
}

function buildItemClick(onSelect: (itemId: string) => void, itemId: string): () => void {
  return function select(): void {
    onSelect(itemId);
  };
}

function ItemGlyph(props: { category: ItemCategory; quantity: number }): ReactElement {
  const { category, quantity } = props;
  const Icon = ITEM_CATEGORY_ICONS[category];
  const color = ITEM_CATEGORY_COLORS[category];
  return (
    <Box
      alignItems="center"
      display="flex"
      height="full"
      justifyContent="center"
      position="relative"
      width="full"
    >
      <Box color={color}>
        <Icon size={ICON_SIZE} />
      </Box>
      <QuantityBadge quantity={quantity} />
    </Box>
  );
}

function QuantityBadge(props: { quantity: number }): ReactElement {
  const { quantity } = props;
  return (
    <Box
      alignItems="center"
      bg="bg.sunken"
      borderRadius="sm"
      bottom="1"
      display="flex"
      justifyContent="center"
      minW="1.25rem"
      paddingBlock="0.5"
      paddingInline="1"
      position="absolute"
      right="1"
    >
      <Text color="fg" variant="numeric">
        {quantity}
      </Text>
    </Box>
  );
}
