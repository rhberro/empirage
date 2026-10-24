import { Box } from '@chakra-ui/react';
import type { HuntTeamMemberActor } from '@creatures/contracts/huntSim';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { NativeButton } from '~/shared/ui/button';
import { IconChevronRight } from '~/shared/ui/icon';
import type { CreatureSlot } from '~/widgets/game-hud/model/gameHud.types';
import { useCanvasScale } from '~/widgets/game-hud/model/useCanvasScale';

import { CreatureTab } from './CreatureTab';
import { EmptyCreatureTab } from './EmptyCreatureTab';

const TEAM_SLOT_COUNT = 5;

type TeamStripProps = {
  activeId: string | null;
  /** The time left of the cooldown of the manual swap. */
  cooldownRemainingMs?: number;
  /** The whole time of the cooldown of the manual swap. */
  cooldownTotalMs?: number;
  /** The live team during a hunt; when present it is the source of the bar. */
  huntTeam?: HuntTeamMemberActor[];
  onSelect: (id: string) => void;
  slots: CreatureSlot[];
};

export function TeamStrip(props: TeamStripProps): ReactElement {
  const {
    activeId,
    cooldownRemainingMs = 0,
    cooldownTotalMs = 0,
    huntTeam,
    onSelect,
    slots,
  } = props;
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const scale = useCanvasScale();
  const scaleTransform = `scale(${scale})`;
  const tabs =
    huntTeam === undefined
      ? renderCityTabs(activeId, cooldownRemainingMs, cooldownTotalMs, onSelect, slots)
      : renderHuntTabs(activeId, cooldownRemainingMs, cooldownTotalMs, onSelect, huntTeam);
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
      transform={scaleTransform}
      transformOrigin="top center"
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

/**
 * The five tabs of a hunt, drawn from the live team the server sends.
 *
 * The live team carries the captured creatures and the fainted state, which the
 * city slots (loaded once) do not know until the hunt ends.
 */
function renderHuntTabs(
  activeId: string | null,
  cooldownRemainingMs: number,
  cooldownTotalMs: number,
  onSelect: (id: string) => void,
  huntTeam: HuntTeamMemberActor[],
): ReactElement[] {
  const bySlot = new Map<number, HuntTeamMemberActor>();
  for (const member of huntTeam) {
    bySlot.set(member.teamSlot, member);
  }
  const tabs: ReactElement[] = [];
  for (let slot = 1; slot <= TEAM_SLOT_COUNT; slot += 1) {
    const member = bySlot.get(slot);
    if (member === undefined) {
      const emptyKey = `empty-${slot}`;
      tabs.push(<EmptyCreatureTab key={emptyKey} />);
      continue;
    }
    const isActive = member.id === activeId;
    tabs.push(
      <CreatureTab
        cooldownRemainingMs={cooldownRemainingMs}
        cooldownTotalMs={cooldownTotalMs}
        huntMember={member}
        isActive={isActive}
        key={member.id}
        onSelect={onSelect}
      />,
    );
  }
  return tabs;
}

function renderCityTabs(
  activeId: string | null,
  cooldownRemainingMs: number,
  cooldownTotalMs: number,
  onSelect: (id: string) => void,
  slots: CreatureSlot[],
): ReactElement[] {
  return slots.map(function render(slot: CreatureSlot, index: number): ReactElement {
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
  });
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
