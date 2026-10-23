import { Box } from '@chakra-ui/react';
import type { ItemCategory } from '@creatures/contracts/inventory';
import type { ReactElement } from 'react';

import { IconChest, IconPotion, IconPrism } from '~/shared/ui/icon';

const ICON_SIZE = '1.5rem';

const CATEGORY_COLORS: Record<ItemCategory, string> = {
  consumable: 'element.plant',
  device: 'element.water',
  material: 'accent.gold',
};

const CATEGORY_ICONS: Record<ItemCategory, (props: { size?: string }) => ReactElement> = {
  consumable: IconPotion,
  device: IconPrism,
  material: IconChest,
};

/**
 * The glyph of an item.
 *
 * The art of the item is not final: the icon of the category and the tone of
 * the category are what the interface has for now.
 */
export function StoreGlyph(props: { category: ItemCategory }): ReactElement {
  const { category } = props;
  const Icon = CATEGORY_ICONS[category];
  return (
    <Box alignItems="center" display="flex" height="full" justifyContent="center" width="full">
      <Box color={CATEGORY_COLORS[category]}>
        <Icon size={ICON_SIZE} />
      </Box>
    </Box>
  );
}
