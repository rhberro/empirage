import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { Frame } from '~/shared/ui/frame';
import { IconChevronRight } from '~/shared/ui/icon';
import type { SkillBarProps } from '~/widgets/game-hud/model/skillBar.types';

import { SkillSlots } from './SkillSlots';
import { Vitals } from './Vitals';

// eslint-disable-next-line max-lines-per-function
export function SkillBar(props: SkillBarProps): ReactElement {
  const {
    children,
    collapsed: controlledCollapsed,
    equippedAbilities,
    equippedConsumables,
    equippedDevice,
    onSlotPress,
    onToggle: controlledToggle,
    openSlot = null,
    shopButton,
    stamina,
    vitals,
  } = props;
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = controlledToggle ?? setInternalCollapsed;
  const ariaLabel = collapsed ? 'Maximizar barra' : 'Minimizar barra';
  const chevronTransform = collapsed ? 'rotate(-90deg)' : 'rotate(90deg)';
  const containerTransform = collapsed ? 'translateY(calc(100% - 2.5rem))' : 'translateY(0)';
  function toggle(): void {
    setCollapsed(!collapsed);
  }
  const content = (
    <>
      <SkillSlots
        abilities={equippedAbilities}
        consumables={equippedConsumables}
        device={equippedDevice}
        onSlotPress={onSlotPress}
        openSlot={openSlot}
      />
      <Box bg="border" height="3.5rem" width="1px" />
      <Vitals stamina={stamina} vitals={vitals} />
    </>
  );
  return (
    <Box bottom={4} left="50%" position="absolute" transform="translateX(-50%)" zIndex={2}>
      <Box
        alignItems="center"
        display="flex"
        flexDirection="column"
        gap={2}
        transform={containerTransform}
        transition="transform 200ms ease-out"
      >
        {shopButton}
        <Frame tone="panel">
          <Box alignItems="center" display="flex" gap={4} padding={2}>
            {content}
          </Box>
        </Frame>
      </Box>
      <NativeButton
        alignItems="center"
        aria-label={ariaLabel}
        bg="bg.raised"
        borderRadius="full"
        boxShadow="raised"
        color="fg"
        cursor="pointer"
        display="flex"
        height="2rem"
        justifyContent="center"
        onClick={toggle}
        bottom="0"
        position="absolute"
        right="-2.5rem"
        width="2rem"
      >
        <Box transform={chevronTransform}>
          <IconChevronRight />
        </Box>
      </NativeButton>
      {children}
    </Box>
  );
}
