import { Image } from '@chakra-ui/react';

import { Icon } from '~/shared/ui/Icon';

import type { CaptureItem } from '../../api/hunt-protocol';
import {
  selectCaptureConfiguration,
  selectCaptureItems,
  useGameStore,
} from '../../model/game-store';
import { toggleCaptureModal } from '../../model/modal-store';
import { Slot } from './Slot';

export function CaptureSlot(): React.ReactElement {
  const configuration = useGameStore(selectCaptureConfiguration);
  const items = useGameStore(selectCaptureItems);
  const selectedItemId = configuration ? configuration.itemId : undefined;
  function selectedItem(item: CaptureItem): boolean {
    return item.id === selectedItemId;
  }
  const selected = items.find(selectedItem);
  const label = selected ? selected.name : 'Captura automática';
  const selectedImageUrl = selected ? captureItemImageUrl(selected) : undefined;
  const content = selected ? (
    <Image alt={selected.name} imageRendering="pixelated" src={selectedImageUrl} />
  ) : (
    <Icon name="add" textStyle="2xl" />
  );
  return (
    <Slot
      content={content}
      cooldownEndsAt={undefined}
      cooldownMs={undefined}
      label={label}
      onClick={toggleCaptureModal}
    />
  );
}

function captureItemImageUrl(item: CaptureItem): string {
  return `/assets/items/pokeballs/${item.slug}.png`;
}
