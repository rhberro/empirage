import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import {
  IconBag,
  IconBell,
  IconBolt,
  IconChest,
  IconClose,
  IconCoin,
  IconCrosshair,
  IconGear,
  IconGem,
  IconHeart,
  IconMap,
  IconPlay,
  IconPotion,
  IconPrism,
  IconSearch,
  IconStore,
  IconTeam,
  IconUsers,
} from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

import { SectionHeader } from './SectionHeader';

type IconEntry = {
  icon: ReactElement;
  name: string;
};

const ICONS: IconEntry[] = [
  { icon: renderIconBag(), name: 'Bag' },
  { icon: renderIconBell(), name: 'Bell' },
  { icon: renderIconBolt(), name: 'Bolt' },
  { icon: renderIconChest(), name: 'Chest' },
  { icon: renderIconClose(), name: 'Close' },
  { icon: renderIconCoin(), name: 'Coin' },
  { icon: renderIconCrosshair(), name: 'Crosshair' },
  { icon: renderIconGem(), name: 'Gem' },
  { icon: renderIconGear(), name: 'Gear' },
  { icon: renderIconHeart(), name: 'Heart' },
  { icon: renderIconMap(), name: 'Map' },
  { icon: renderIconPlay(), name: 'Play' },
  { icon: renderIconPotion(), name: 'Potion' },
  { icon: renderIconPrism(), name: 'Prism' },
  { icon: renderIconSearch(), name: 'Search' },
  { icon: renderIconStore(), name: 'Store' },
  { icon: renderIconTeam(), name: 'Team' },
  { icon: renderIconUsers(), name: 'Users' },
];

export function IconsSection(): ReactElement {
  const cells = ICONS.map(renderIconCell);
  return (
    <Box marginBlockEnd="16">
      <SectionHeader
        description="Um traço só, 2px na grade de 24, desenhado para 1rem. Todos os ícones compõem a mesma primitiva Icon, que carrega o tamanho e o traço — um ícone novo é só o caminho, nunca um svg inteiro. A cor vem do estado, nunca do arquivo."
        id="icones"
        title="Ícones"
      />
      <Box display="grid" gap="3" gridTemplateColumns="repeat(8, 1fr)">
        {cells}
      </Box>
    </Box>
  );
}

function renderIconCell(entry: IconEntry): ReactElement {
  return (
    <Box
      alignItems="center"
      bg="bg.panel"
      borderRadius="lg"
      boxShadow="raised"
      display="flex"
      flexDirection="column"
      gap="2"
      justifyContent="center"
      key={entry.name}
      paddingBlock="4"
      paddingInline="2"
    >
      <Box color="fg">{entry.icon}</Box>
      <Text color="fg.subtle" variant="meta">
        {entry.name}
      </Text>
    </Box>
  );
}

function renderIconBag(): ReactElement {
  return <IconBag size="1.5rem" />;
}

function renderIconBell(): ReactElement {
  return <IconBell size="1.5rem" />;
}

function renderIconBolt(): ReactElement {
  return <IconBolt size="1.5rem" />;
}

function renderIconChest(): ReactElement {
  return <IconChest size="1.5rem" />;
}

function renderIconClose(): ReactElement {
  return <IconClose size="1.5rem" />;
}

function renderIconCoin(): ReactElement {
  return <IconCoin size="1.5rem" />;
}

function renderIconCrosshair(): ReactElement {
  return <IconCrosshair size="1.5rem" />;
}

function renderIconGem(): ReactElement {
  return <IconGem size="1.5rem" />;
}

function renderIconGear(): ReactElement {
  return <IconGear size="1.5rem" />;
}

function renderIconHeart(): ReactElement {
  return <IconHeart size="1.5rem" />;
}

function renderIconMap(): ReactElement {
  return <IconMap size="1.5rem" />;
}

function renderIconPlay(): ReactElement {
  return <IconPlay size="1.5rem" />;
}

function renderIconPotion(): ReactElement {
  return <IconPotion size="1.5rem" />;
}

function renderIconPrism(): ReactElement {
  return <IconPrism size="1.5rem" />;
}

function renderIconSearch(): ReactElement {
  return <IconSearch size="1.5rem" />;
}

function renderIconStore(): ReactElement {
  return <IconStore size="1.5rem" />;
}

function renderIconTeam(): ReactElement {
  return <IconTeam size="1.5rem" />;
}

function renderIconUsers(): ReactElement {
  return <IconUsers size="1.5rem" />;
}
