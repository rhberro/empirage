import { Box, Link } from '@chakra-ui/react';
import { type ReactElement, useState } from 'react';

import { DIVIDER_BOTTOM } from '~/shared/theme';
import { Drawer } from '~/shared/ui/drawer';
import { IconChevronRight, IconCoin } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

import { RAIL_GROUPS } from './rail';
import type { RailGroup, RailItem, RailSubGroup } from './rail';

const DRAWER_WIDTH = '17.5rem';
const RAIL_WIDTH = '14.5rem';
const TOOLBAR_HEIGHT = '3.5rem';

const RAIL_HOVER = { bg: 'bg.raised', color: 'fg' };

type SideRailProps = {
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export function SideRail(props: SideRailProps): ReactElement {
  const { isMobile, isOpen, onClose } = props;
  const railHeight = `calc(100dvh - ${TOOLBAR_HEIGHT})`;
  if (isMobile) {
    return (
      <Drawer isOpen={isOpen} label="Navegação" onClose={onClose} width={DRAWER_WIDTH}>
        <RailContent onNavigate={onClose} />
      </Drawer>
    );
  }
  return (
    <Box
      bg="bg.panel"
      borderRight="1px solid"
      borderColor="border"
      height={railHeight}
      overflowY="auto"
      paddingBlock="6"
      paddingInline="3"
      position="sticky"
      top={TOOLBAR_HEIGHT}
      width={RAIL_WIDTH}
    >
      <RailContent onNavigate={onClose} />
    </Box>
  );
}

function RailContent(props: { onNavigate: () => void }): ReactElement {
  const { onNavigate } = props;
  const groups = RAIL_GROUPS.map(renderGroup(onNavigate));
  return (
    <>
      <BrandMark />
      {groups}
    </>
  );
}

function renderGroup(onNavigate: () => void): (group: RailGroup) => ReactElement {
  return function renderGroupEntry(group: RailGroup): ReactElement {
    return <RailGroupView group={group} key={group.group} onNavigate={onNavigate} />;
  };
}

function renderItem(onNavigate: () => void): (item: RailItem) => ReactElement {
  return function renderItemEntry(item: RailItem): ReactElement {
    return <RailItemView item={item} key={item.href} onNavigate={onNavigate} />;
  };
}

function renderSubGroup(onNavigate: () => void): (subGroup: RailSubGroup) => ReactElement {
  return function renderSubGroupEntry(subGroup: RailSubGroup): ReactElement {
    return <RailSubGroupView key={subGroup.label} onNavigate={onNavigate} subGroup={subGroup} />;
  };
}

function RailGroupView(props: { group: RailGroup; onNavigate: () => void }): ReactElement {
  const { group, onNavigate } = props;
  const items = group.items.map(renderItem(onNavigate));
  const subGroups = group.subGroups.map(renderSubGroup(onNavigate));
  return (
    <Box marginBlockEnd="6">
      <Text color="fg.subtle" paddingBlockEnd="2" paddingInline="3" variant="meta">
        {group.group}
      </Text>
      {items}
      {subGroups}
    </Box>
  );
}

function RailSubGroupView(props: { onNavigate: () => void; subGroup: RailSubGroup }): ReactElement {
  const { onNavigate, subGroup } = props;
  const [isOpen, setIsOpen] = useState(true);
  const items = isOpen ? subGroup.items.map(renderItem(onNavigate)) : null;
  const list = items === null ? null : <Box paddingInlineStart="3">{items}</Box>;
  const rotation = isOpen ? 'rotate(90deg)' : undefined;
  function handleToggle(): void {
    setIsOpen(!isOpen);
  }
  return (
    <Box marginBlockEnd="4">
      <Box
        aria-expanded={isOpen}
        as="button"
        cursor="pointer"
        display="flex"
        justifyContent="space-between"
        onClick={handleToggle}
        paddingBlock="1.5"
        paddingInline="3"
        textAlign="start"
        width="full"
      >
        <Text color="fg.subtle" variant="meta">
          {subGroup.label}
        </Text>
        <Box
          transform={rotation}
          transitionDuration="150ms"
          transitionProperty="transform"
          transitionTimingFunction="ease-out"
        >
          <IconChevronRight size="0.875rem" />
        </Box>
      </Box>
      {list}
    </Box>
  );
}

function RailItemView(props: { item: RailItem; onNavigate: () => void }): ReactElement {
  const { item, onNavigate } = props;
  return (
    <Link
      _hover={RAIL_HOVER}
      color="fg.muted"
      display="block"
      href={item.href}
      onClick={onNavigate}
      paddingBlock="1.5"
      paddingInline="3"
      textDecoration="none"
    >
      <Text variant="label">{item.label}</Text>
    </Link>
  );
}

function BrandMark(): ReactElement {
  return (
    <Box
      alignItems="center"
      css={DIVIDER_BOTTOM}
      display="flex"
      gap="3"
      marginBlockEnd="6"
      paddingBlock="3"
      paddingInline="3"
    >
      <Box
        alignItems="center"
        bg="bg.raised"
        borderRadius="sm"
        boxShadow="sm"
        color="currency.gold"
        display="flex"
        height="1.875rem"
        justifyContent="center"
        width="1.875rem"
      >
        <IconCoin />
      </Box>
      <Text color="fg" variant="title">
        Creatures
      </Text>
    </Box>
  );
}
