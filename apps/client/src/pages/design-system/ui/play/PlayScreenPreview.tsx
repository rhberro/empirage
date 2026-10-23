import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { SAMPLE_STORE_CATALOG, StoreModal } from '~/features/store';
import { SCREEN_ANCHORS } from '~/pages/design-system/ui/rail';
import { ScreenEntry } from '~/pages/design-system/ui/sections/ScreenEntry';
import {
  ACTIVE_CREATURE_ID,
  PlayButton,
  SAMPLE_EQUIPPED_ABILITIES,
  SAMPLE_EQUIPPED_CONSUMABLES,
  SAMPLE_EQUIPPED_DEVICE,
  SAMPLE_VITALS,
  ShopButton,
  SkillBar,
  TEAM_SLOTS,
  TeamStrip,
  Toolbar,
} from '~/widgets/game-hud';

import { CanvasArea } from './GameCanvas';

export function PlayScreenPreview(): ReactElement {
  return (
    <Box marginBlockEnd="16">
      <Box display="flex" flexDirection="column" gap="8">
        <ScreenEntry
          description="A toolbar, as linguetas do time, a barra de habilidades e os botões de cidade, com a mesma linguagem das referências. O canvas é o espaço do PixiJS."
          frameMinHeight="35rem"
          id={SCREEN_ANCHORS.telaDoJogo}
          title="Tela do jogo"
        >
          <PlayScreenFrame />
        </ScreenEntry>
        <ScreenEntry
          description="O modal sobre a tela, com as abas Comprar e Vender, a grade de slots com espaços vazios, o estado selecionado e o rodapé com quantidade, total e a ação."
          frameMinHeight="43.75rem"
          id={SCREEN_ANCHORS.loja}
          title="Loja"
        >
          <StoreModal contained isOpen onClose={noop} snapshot={SAMPLE_STORE_CATALOG} />
        </ScreenEntry>
      </Box>
    </Box>
  );
}

function PlayScreenFrame(): ReactElement {
  return (
    <Box
      bg="bg"
      border="1px solid"
      borderColor="border.emphasized"
      display="flex"
      flexDirection="column"
      minH="35rem"
      overflow="hidden"
      position="relative"
    >
      <Toolbar
        diamonds={240}
        gold={12480}
        trainerLevel={1}
        trainerName="Jogador"
        onOpenBackpack={noop}
        onOpenStorage={noop}
        onSignOut={noop}
        onSwitchTrainer={noop}
      />
      <Box display="flex" flex="1" position="relative">
        <CanvasArea />
        <TeamStrip activeId={ACTIVE_CREATURE_ID} slots={TEAM_SLOTS} onSelect={noop} />
        <PlayButton onClick={noop} />
        <ShopButton onClick={noop} />
        <SkillBar
          equippedAbilities={SAMPLE_EQUIPPED_ABILITIES}
          equippedConsumables={SAMPLE_EQUIPPED_CONSUMABLES}
          equippedDevice={SAMPLE_EQUIPPED_DEVICE}
          vitals={SAMPLE_VITALS}
        />
      </Box>
    </Box>
  );
}

function noop(): void {
  void 0;
}
