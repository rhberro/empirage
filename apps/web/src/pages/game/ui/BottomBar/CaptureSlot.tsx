import { Image } from '@chakra-ui/react';

import { Icon } from '~/shared/ui/Icon';

import type { CaptureConfiguration, CaptureItem } from '../../api/hunt-protocol';
import { toggleCaptureModal } from '../../model/modal-store';
import { Slot } from './Slot';

type CaptureSlotProps = {
  configuration: CaptureConfiguration | undefined;
  items: Array<CaptureItem>;
};

export function CaptureSlot(props: CaptureSlotProps): React.ReactElement {
  const { configuration, items } = props;
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
