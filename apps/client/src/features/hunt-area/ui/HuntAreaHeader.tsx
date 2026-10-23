import { Box } from '@chakra-ui/react';
import type { HuntArea } from '@creatures/contracts/hunt';
import type { ReactElement } from 'react';

import { HUNT_AREA_TONE_COLORS } from '~/features/hunt-area/model/huntAreaTone';
import { HuntAreaLevels } from '~/features/hunt-area/ui/HuntAreaLevels';
import { Text } from '~/shared/ui/text';

const IMAGE_HEIGHT = '11.25rem';

type HuntAreaHeaderProps = {
  area: HuntArea;
};

/**
 * The header of the drawer.
 *
 * The image of the area is a placeholder of a solid color, and the name and
 * the recommended level are drawn over it.
 */
export function HuntAreaHeader(props: HuntAreaHeaderProps): ReactElement {
  const { area } = props;
  const tone = HUNT_AREA_TONE_COLORS[area.tone];

  return (
    <Box position="relative">
      <Box bg={tone.surface} height={IMAGE_HEIGHT} width="full" />
      <Box
        bg="bg.veil"
        bottom="0"
        height="auto"
        left="0"
        opacity={0.62}
        position="absolute"
        right="0"
      />
      <Box bottom="3" left="4" position="absolute">
        <Text color="fg" variant="section">
          {area.name}
        </Text>
        <HuntAreaLevels minimumLevel={area.minimumLevel} recommendedLevel={area.recommendedLevel} />
      </Box>
    </Box>
  );
}
