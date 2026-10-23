import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Chip } from '~/shared/ui/chip';
import { Frame, FrameHeader, Slot } from '~/shared/ui/frame';
import { IconCrosshair, IconGem, IconPotion, IconPrism } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

import { SectionHeader } from './SectionHeader';

const FRAME_TONES = ['panel', 'recessed', 'overlay'] as const;

export function SurfacesSection(): ReactElement {
  const frames = FRAME_TONES.map(renderFrameTone);
  return (
    <Box marginBlockEnd="16">
      <SectionHeader
        description="O Frame é o único painel do sistema. Toda tela, modal e seção usa ele, e é o que impede uma página de parecer outra. A borda é sombra em camadas, não traço: em fundo escuro a sombra vira a própria borda."
        id="superficies"
        title="Superfícies"
      />
      <Box display="flex" flexWrap="wrap" gap="5" marginBlockEnd="8">
        {frames}
      </Box>
      <SlotsBlock />
      <ChipsBlock />
    </Box>
  );
}

function renderFrameTone(tone: (typeof FRAME_TONES)[number]): ReactElement {
  const label = tone === 'panel' ? 'Painel' : tone === 'recessed' ? 'Rebaixo' : 'Sobreposição';
  const body = `Superfície ${label.toLowerCase()}, com a mesma anatomia em toda parte.`;
  const isOverlay = tone === 'overlay';
  return (
    <Box key={tone} width="16.25rem">
      <Frame accent={isOverlay} tone={tone}>
        <FrameHeader>{label}</FrameHeader>
        <Box padding="4">
          <Text color="fg.muted" variant="body">
            {body}
          </Text>
        </Box>
      </Frame>
    </Box>
  );
}

function SlotsBlock(): ReactElement {
  return (
    <Box marginBlockEnd="8">
      <Text color="fg" marginBlockEnd="1" variant="section">
        Slots
      </Text>
      <Text color="fg.muted" marginBlockEnd="4" maxW="70ch" variant="body">
        O slot guarda um item. Selecionado ganha o traço violeta e o marcador de canto; equipado
        ganha a cunha no canto oposto. Os dois marcadores são geométricos, sem brilho, e a
        informação nunca depende só da cor.
      </Text>
      <Box display="flex" gap="4">
        <Slot>
          <Box bg="arcane.500" height="100%" opacity="0.85" width="100%" />
        </Slot>
        <Slot selected>
          <Box bg="ember.500" height="100%" opacity="0.85" width="100%" />
        </Slot>
        <Slot equipped>
          <Box bg="verdant.500" height="100%" opacity="0.85" width="100%" />
        </Slot>
        <Slot empty />
      </Box>
    </Box>
  );
}

function ChipTonesBlock(): ReactElement {
  return (
    <Box marginBlockStart="6">
      <Text color="fg.muted" marginBlockEnd="3" maxW="70ch" variant="body">
        O chip tem uma variante de cor por elemento. É assim que o elemento de uma criatura aparece
        em filtro, em card e em lista, sempre com o mesmo matiz.
      </Text>
      <Box display="flex" flexWrap="wrap" gap="3">
        <Chip tone="ember">Fogo</Chip>
        <Chip active tone="ember">
          Fogo
        </Chip>
        <Chip tone="verdant">Planta</Chip>
        <Chip active tone="verdant">
          Planta
        </Chip>
        <Chip tone="frost">Gelo</Chip>
        <Chip active tone="frost">
          Gelo
        </Chip>
        <Chip tone="arcane">Sombrio</Chip>
        <Chip active tone="arcane">
          Sombrio
        </Chip>
        <Chip tone="gold">Ouro</Chip>
        <Chip active tone="gold">
          Ouro
        </Chip>
        <Chip tone="blood">Perigo</Chip>
        <Chip active tone="blood">
          Perigo
        </Chip>
      </Box>
    </Box>
  );
}

function ChipsBlock(): ReactElement {
  return (
    <Box>
      <Text color="fg" marginBlockEnd="1" variant="section">
        Chips
      </Text>
      <Text color="fg.muted" marginBlockEnd="4" maxW="70ch" variant="body">
        O chip é inclinado, como os filtros de atributo do Dota 2. O texto é compensado para ficar
        reto dentro da forma.
      </Text>
      <Box display="flex" flexWrap="wrap" gap="3">
        <Chip>Todos</Chip>
        <Chip active>
          <IconCrosshair />
          Fogo
        </Chip>
        <Chip>
          <IconPotion />
          Planta
        </Chip>
        <Chip disabled>Vazio</Chip>
      </Box>
      <ChipTonesBlock />
      <Box display="flex" gap="3" marginBlockStart="4">
        <Slot>
          <Box alignItems="center" display="flex" height="100%" justifyContent="center">
            <Box color="frost.400">
              <IconPrism />
            </Box>
          </Box>
        </Slot>
        <Slot>
          <Box alignItems="center" display="flex" height="100%" justifyContent="center">
            <Box color="currency.gold">
              <IconGem />
            </Box>
          </Box>
        </Slot>
      </Box>
    </Box>
  );
}
