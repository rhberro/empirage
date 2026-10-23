import { Box } from '@chakra-ui/react';
import type { ItemCategory } from '@creatures/contracts/inventory';
import type { ReactElement } from 'react';

import { ItemTooltip } from '~/entities/item';
import { StoreCoins } from '~/features/store/ui/StoreCoins';
import { StoreGlyph } from '~/features/store/ui/StoreGlyph';
import { NativeButton } from '~/shared/ui/button';
import { SLOT_SIZE, Slot } from '~/shared/ui/frame';
import { Popup, useHasHoverCapability, useSlotTooltip } from '~/shared/ui/popup';
import { Text } from '~/shared/ui/text';

export type StoreSlotProps = {
  category: ItemCategory;
  /** The description of the item. */
  description: string;
  isSelected?: boolean;
  name: string;
  onSelect?: () => void;
  /** The quantity of the stack, when the slot shows one. */
  quantity?: number;
  /** The value of the item, in gold coins. */
  value: number;
};

/**
 * The slot of an item of the store.
 *
 * The popup shows the name of the item and what it is worth: the value of the
 * buy in the buy tab, the value of the sale in the sell tab. The value stays
 * out of the `ItemTooltip` on purpose: the tooltip draws its own label, and
 * the popup keeps the coin and the number alone — the same `StoreCoins` the
 * footer total shows.
 *
 * On the desktop, the hover shows the popup and the click closes it while
 * the item gets chosen. On the touch, the tap does both at once: the item is
 * chosen and the popup shows the value, so the player never picks a price
 * they have not seen; tapping the same item again, or anywhere else, hides
 * the popup.
 */
export function StoreSlot(props: StoreSlotProps): ReactElement {
  const { category, description, isSelected = false, name, onSelect, quantity, value } = props;
  const hasHover = useHasHoverCapability();
  const slotTooltip = useSlotTooltip(hasHover);
  const content = (
    <Box display="flex" flexDirection="column" gap="1">
      <ItemTooltip description={description} name={name} />
      <StoreCoins value={value} />
    </Box>
  );
  const badge = buildQuantityBadge(quantity);
  const label = buildSlotLabel(name, quantity);
  const touchTapToggle = hasHover ? undefined : slotTooltip.handleTapToggle;
  const trigger = (
    <NativeButton
      aria-label={label}
      cursor="pointer"
      display="block"
      onClick={onSelect}
      position="relative"
      width={SLOT_SIZE}
    >
      <Slot selected={isSelected}>
        <StoreGlyph category={category} />
      </Slot>
      {badge}
    </NativeButton>
  );
  return (
    <Box
      display="contents"
      onClick={touchTapToggle}
      onPointerDown={slotTooltip.handlePointerDown}
      onPointerEnter={slotTooltip.handlePointerEnter}
      onPointerLeave={slotTooltip.handlePointerLeave}
      ref={slotTooltip.triggerRef}
    >
      <Popup content={content} disabled={slotTooltip.menuOpen} open={slotTooltip.open}>
        {trigger}
      </Popup>
    </Box>
  );
}

/**
 * The quantity of the stack, in the corner of the slot.
 */
function buildQuantityBadge(quantity: number | undefined): ReactElement | null {
  if (quantity === undefined) {
    return null;
  }
  const amount = (
    <Text color="fg" variant="numeric">
      {quantity}
    </Text>
  );
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
      {amount}
    </Box>
  );
}

function buildSlotLabel(name: string, quantity: number | undefined): string {
  if (quantity === undefined) {
    return name;
  }
  return `${name} (${quantity})`;
}
