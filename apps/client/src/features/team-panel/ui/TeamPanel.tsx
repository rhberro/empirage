import { Flex } from '@chakra-ui/react';
import * as React from 'react';

import { useCanvasTransform } from '~/widgets/game-hud/model/useCanvasScale';

import { CollapseButton } from './CollapseButton';
import { TeamSlot } from './TeamSlot';

function TeamPanelComponent(): React.ReactElement {
  const transform = useCanvasTransform();
  const ref = React.useRef<HTMLDivElement>(null);
  function onToggle(): void {
    if (ref && ref.current) {
      ref.current.classList.toggle('collapsed');
    }
  }
  const css = {
    '& .slot:empty': {
      height: '0rem',
    },
    '& .toggle': {
      transform: 'rotate(-90deg)',
    },
    '&.collapsed .slot:not(:empty)': {
      transform: 'translateY(-70%)',
    },
    '&.collapsed .toggle': {
      transform: 'rotate(90deg)',
    },
  };
  return (
    <Flex
      css={css}
      gap="1"
      position="absolute"
      ref={ref}
      right="5%"
      transform={transform}
      transformOrigin="top center"
      zIndex={0}
    >
      <Flex gap="2">
        <TeamSlot position={0} />
        <TeamSlot position={1} />
        <TeamSlot position={2} />
        <TeamSlot position={3} />
        <TeamSlot position={4} />
      </Flex>
      <CollapseButton onToggle={onToggle} />
    </Flex>
  );
}

export const TeamPanel = React.memo(TeamPanelComponent);
