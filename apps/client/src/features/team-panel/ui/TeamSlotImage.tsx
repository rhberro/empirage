import { AspectRatio, Bleed } from '@chakra-ui/react';

import { CreatureImage } from '~/entities/creature';

export function TeamSlotImage(props: React.PropsWithChildren<unknown>): React.ReactElement {
  const { children } = props;
  return (
    <Bleed blockStart="2" inline="1">
      <AspectRatio>
        <CreatureImage identifier="1">{children}</CreatureImage>
      </AspectRatio>
    </Bleed>
  );
}
