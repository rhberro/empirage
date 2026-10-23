import { Box, useBreakpointValue } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { IconButton } from '~/shared/ui/button';
import { IconMap } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';
import { Toolbar } from '~/widgets/game-hud';

import { PlayScreenPreview } from './play/PlayScreenPreview';
import { ColorFoundations } from './sections/ColorFoundations';
import { ComponentsSection } from './sections/ComponentsSection';
import { IconsSection } from './sections/IconsSection';
import { ScreensSection } from './sections/ScreensSection';
import { StatesSection } from './sections/StatesSection';
import { SurfacesSection } from './sections/SurfacesSection';
import { TypeFoundations } from './sections/TypeFoundations';
import { SideRail } from './SideRail';

const DIAMOND_AMOUNT = 240;
const GOLD_AMOUNT = 12480;
const TRAINER_LEVEL = 1;
const TRAINER_NAME = 'Jogador';

const IS_MOBILE = { base: true, md: false };

/**
 * The samples below are drawn at desktop size. On a phone their fixed widths
 * and viewport-sized layer backdrops would widen the page, so clamp them to the
 * column and let the content reflow instead of forcing a horizontal scroll.
 */
const CONTENT_LAYOUT = {
  '@media (max-width: 47.9988rem)': {
    '& *': { maxWidth: '100%', minWidth: 0 },
  },
  padding: { base: '4', md: '10' },
};

/**
 * The game toolbar is drawn at desktop size too. On a phone it scrolls inside
 * the header instead of stretching the page; on larger screens it is untouched.
 */
const TOOLBAR_SCROLL = {
  overflowX: { base: 'auto', md: 'visible' },
  overflowY: { base: 'hidden', md: 'visible' },
};

type TopBarProps = {
  isMobile: boolean;
  onOpenRail: () => void;
};

export function DesignSystemPage(): ReactElement {
  const isMobile = useBreakpointValue(IS_MOBILE) ?? false;
  const [isRailOpen, setIsRailOpen] = useState(false);
  function openRail(): void {
    setIsRailOpen(true);
  }
  function closeRail(): void {
    setIsRailOpen(false);
  }
  return (
    <Box bg="bg" color="fg" minH="100dvh">
      <TopBar isMobile={isMobile} onOpenRail={openRail} />
      <Box alignItems="flex-start" display="flex">
        <SideRail isMobile={isMobile} isOpen={isRailOpen} onClose={closeRail} />
        <Box css={CONTENT_LAYOUT} flex="1" marginInline="auto" maxW="77.5rem" minW="0" width="100%">
          <ColorFoundations />
          <TypeFoundations />
          <SurfacesSection />
          <ComponentsSection />
          <IconsSection />
          <StatesSection />
          <PlayScreenPreview />
          <ScreensSection />
        </Box>
      </Box>
    </Box>
  );
}

function TopBar(props: TopBarProps): ReactElement {
  const { isMobile, onOpenRail } = props;
  const mobileBar = isMobile ? <MobileBar onOpenRail={onOpenRail} /> : null;
  return (
    <Box position="sticky" top="0" zIndex="10">
      {mobileBar}
      <Box css={TOOLBAR_SCROLL}>
        <Toolbar
          diamonds={DIAMOND_AMOUNT}
          gold={GOLD_AMOUNT}
          trainerLevel={TRAINER_LEVEL}
          trainerName={TRAINER_NAME}
          onOpenBackpack={noop}
          onOpenStorage={noop}
          onSignOut={noop}
          onSwitchTrainer={noop}
        />
      </Box>
    </Box>
  );
}

function MobileBar(props: { onOpenRail: () => void }): ReactElement {
  const { onOpenRail } = props;
  return (
    <Box
      alignItems="center"
      bg="bg.panel"
      borderBottom="1px solid"
      borderColor="border"
      display="flex"
      gap="3"
      paddingBlock="2"
      paddingInline="3"
    >
      <IconButton label="Abrir navegação" onClick={onOpenRail}>
        <IconMap />
      </IconButton>
      <Text color="fg" variant="title">
        Creatures
      </Text>
    </Box>
  );
}

function noop(): void {
  void 0;
}
