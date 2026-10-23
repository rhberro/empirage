import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { Drawer, DrawerHeader } from '~/shared/ui/drawer';
import { Cooldown, Frame, FrameHeader, Slot } from '~/shared/ui/frame';
import { Modal, ModalHeader } from '~/shared/ui/modal';
import { PopupCard } from '~/shared/ui/popup';
import { Text } from '~/shared/ui/text';

export function BaseComponents(): ReactElement {
  return (
    <Box>
      <SurfacesBlock />
      <LayersBlock />
    </Box>
  );
}

function SurfacesBlock(): ReactElement {
  return (
    <Box display="flex" flexWrap="wrap" gap="6">
      <Box>
        <Text color="fg" marginBlockEnd="3" variant="section">
          Slot
        </Text>
        <Box display="flex" gap="3">
          <Slot />
          <Slot selected />
          <Slot equipped />
        </Box>
      </Box>
      <Box>
        <Text color="fg" marginBlockEnd="3" variant="section">
          Cooldown
        </Text>
        <Box height="3.5rem" position="relative" width="3.5rem">
          <Slot>
            <Box alignItems="center" display="flex" height="100%" justifyContent="center">
              <Text color="ember.400" variant="numeric">
                4
              </Text>
            </Box>
          </Slot>
          <Cooldown remaining={2200} total={5000} />
        </Box>
      </Box>
      <Box>
        <Text color="fg" marginBlockEnd="3" variant="section">
          Popup
        </Text>
        <PopupCard width="12.5rem">
          <Text variant="name">Poção de Cura</Text>
          <Text color="fg.muted" variant="body">
            Restaura 40 pontos de vida.
          </Text>
        </PopupCard>
      </Box>
    </Box>
  );
}

function LayersBlock(): ReactElement {
  return (
    <Box marginBlockStart="8">
      <Text color="fg" marginBlockEnd="1" variant="section">
        Superfícies e camadas
      </Text>
      <LayersDescription />
      <Box display="flex" flexWrap="wrap" gap="5">
        <LayerSample description="Uma superfície dentro da página." label="Painel">
          <PanelSample />
        </LayerSample>
        <LayerSample description="Camada centrada sobre a tela." label="Modal">
          <ModalSample />
        </LayerSample>
        <LayerSample description="Camada pela lateral da tela." label="Drawer">
          <DrawerSample />
        </LayerSample>
      </Box>
    </Box>
  );
}

/**
 * A descricao das camadas.
 */
function LayersDescription(): ReactElement {
  return (
    <Text color="fg.muted" marginBlockEnd="5" maxW="70ch" variant="body">
      O <strong>painel</strong> é uma superfície dentro da página: ele ocupa o lugar dele no layout
      e não toma a tela. O <strong>modal</strong> e o <strong>drawer</strong> são camadas acima de
      tudo: eles cobrem a tela, escurecem o fundo e fecham sozinhos. Os três usam a mesma anatomia —
      cabeçalho, corpo e rodapé — e por isso andam juntos.
    </Text>
  );
}

/**
 * A amostra do modal: uma camada centrada sobre a tela.
 */
function ModalSample(): ReactElement {
  return (
    <Box height="17.5rem" overflow="hidden" padding="1rem" position="relative" width="24.5rem">
      <Modal contained isOpen onClose={noop} width="17.5rem">
        <ModalHeader>Loja</ModalHeader>
        <Box padding="4">
          <Text color="fg.muted" variant="body">
            Cobre a tela, escurece o fundo e fecha por ESC ou pelo botão.
          </Text>
        </Box>
      </Modal>
    </Box>
  );
}

/**
 * A amostra do drawer: uma camada pela lateral da tela.
 */
function DrawerSample(): ReactElement {
  return (
    <Box height="17.5rem" overflow="hidden" padding="1rem" position="relative" width="24.5rem">
      <Drawer contained isOpen onClose={noop}>
        <DrawerHeader>Detalhes da área</DrawerHeader>
        <Box padding="4">
          <Text color="fg.muted" variant="body">
            Entra pela lateral e fecha também pelo clique no fundo.
          </Text>
        </Box>
      </Drawer>
    </Box>
  );
}

function PanelSample(): ReactElement {
  return (
    <Frame tone="panel">
      <FrameHeader>Painel</FrameHeader>
      <Box padding="4">
        <Text color="fg.muted" variant="body">
          Vive no fluxo da página e divide o espaço com o resto.
        </Text>
      </Box>
    </Frame>
  );
}

type LayerSampleProps = {
  children: ReactElement;
  description: string;
  label: string;
};

function LayerSample(props: LayerSampleProps): ReactElement {
  const { children, description, label } = props;
  return (
    <Box>
      <Text color="fg" marginBlockEnd="1" variant="label">
        {label}
      </Text>
      {children}
      <Text color="fg.subtle" marginBlockStart="2" maxW="70ch" variant="meta">
        {description}
      </Text>
    </Box>
  );
}

function noop(): void {
  void 0;
}
