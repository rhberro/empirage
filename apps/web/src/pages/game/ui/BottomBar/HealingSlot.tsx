import { Image } from '@chakra-ui/react';

import { Icon } from '~/shared/ui/Icon';

import { HealingItem } from '../../api/hunt-protocol';
import {
  selectHealingConfiguration,
  selectHealingItemCooldownEndsAt,
  selectHealingItems,
  useGameStore,
} from '../../model/game-store';
import { toggleHealingItemModal } from '../../model/modal-store';
import { Slot } from './Slot';

type HealingItems = Array<HealingItem>;

export function HealingSlot(): React.ReactElement {
  const healingConfiguration = useGameStore(selectHealingConfiguration);
  const healingItemCooldownEndsAt = useGameStore(selectHealingItemCooldownEndsAt);
  const healingItems = useGameStore(selectHealingItems);
  const { itemId } = healingConfiguration ?? {};
  const selected = getSelectedHealingItem(healingItems, itemId);
  if (selected) {
    const { name, slug } = selected;
    const path = '/assets/items/medicine/' + slug + '.png';
    const content = <Image bg="bg.info" p="3" src={path} w="full" />;
    return (
      <Slot
        content={content}
        cooldownEndsAt={healingItemCooldownEndsAt}
        cooldownMs={1_000}
        label={name}
        onClick={toggleHealingItemModal}
      />
    );
  }
  const content = <Icon name="add" textStyle="2xl" />;
  return (
    <Slot
      content={content}
      cooldownEndsAt={undefined}
      cooldownMs={undefined}
      label="Medicina"
      onClick={toggleHealingItemModal}
    />
  );
}

function getSelectedHealingItem(
  healingItems: HealingItems,
  healingItemId: number | undefined,
): HealingItem | undefined {
  for (const healingItem of healingItems) {
    if (healingItem.id === healingItemId) {
      return healingItem;
    }
  }
  return undefined;
}
