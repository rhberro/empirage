import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { IconChevronRight } from '~/shared/ui/icon';
import type { CreatureSlot } from '~/widgets/game-hud/model/gameHud.types';

import { CreatureTab } from './CreatureTab';
import { EmptyCreatureTab } from './EmptyCreatureTab';

type TeamStripProps = {
  activeId: string | null;
  /** The time left of the cooldown of the manual swap. */
  cooldownRemainingMs?: number;
  /** The whole time of the cooldown of the manual swap. */
  cooldownTotalMs?: number;
  onSelect: (id: string) => void;
  slots: CreatureSlot[];
};

export function TeamStrip(props: TeamStripProps): ReactElement {
  const { activeId, cooldownRemainingMs = 0, cooldownTotalMs = 0, onSelect, slots } = props;
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const tabs = slots.map(renderTab(activeId, cooldownRemainingMs, cooldownTotalMs, onSelect));
  const containerTransform = collapsed ? 'translateY(-70%)' : 'translateY(0)';
  return (
    <Box
      alignItems="flex-start"
      display="flex"
      gap="1"
      justifyContent="center"
      left="0"
      position="absolute"
      right="0"
      top="3"
      zIndex={0}
    >
      <Box
        alignItems="flex-start"
        display="flex"
        gap="1"
        transform={containerTransform}
        transition="transform 200ms ease-out"
      >
        {tabs}
      </Box>
      <CollapseButton collapsed={collapsed} onToggle={setCollapsed} />
    </Box>
  );
}

function CollapseButton(props: {
  collapsed: boolean;
  onToggle: (value: boolean) => void;
}): ReactElement {
  const { collapsed, onToggle } = props;
  const label = collapsed ? 'Maximizar equipe' : 'Minimizar equipe';
  const chevronTransform = collapsed ? 'rotate(90deg)' : 'rotate(-90deg)';
  function toggle(): void {
    onToggle(!collapsed);
  }
  return (
    <NativeButton
      alignItems="center"
      aria-label={label}
      bg="bg.raised"
      borderRadius="full"
      boxShadow="raised"
      color="fg"
      cursor="pointer"
      display="flex"
      height="2rem"
      justifyContent="center"
      marginInlineStart="2"
      onClick={toggle}
      width="2rem"
    >
      <Box transform={chevronTransform}>
        <IconChevronRight />
      </Box>
    </NativeButton>
  );
}

function renderTab(
  activeId: string | null,
  cooldownRemainingMs: number,
  cooldownTotalMs: number,
  onSelect: (id: string) => void,
): (slot: CreatureSlot, index: number) => ReactElement {
  return function render(slot: CreatureSlot, index: number): ReactElement {
    if (slot === null) {
      const emptyKey = `empty-${index}`;
      return <EmptyCreatureTab key={emptyKey} />;
    }
    const isActive = slot.id === activeId;
    return (
      <CreatureTab
        cooldownRemainingMs={cooldownRemainingMs}
        cooldownTotalMs={cooldownTotalMs}
        creature={slot}
        isActive={isActive}
        key={slot.id}
        onSelect={onSelect}
      />
    );
  };
}
