import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { PanelCardEntry } from '~/features/skill-panel/model/skillPanel.types';
import { PanelState } from '~/shared/ui/empty';
import { Frame } from '~/shared/ui/frame';

import { PANEL_WIDTH } from './panel.constants';
import { PanelHeader } from './PanelHeader';
import { PanelList } from './PanelList';

const DEVICE_SLOT_NUMBER = 7;
const EMPTY_MESSAGE = 'Nenhum dispositivo disponível';

type DeviceSelectionPanelProps = {
  entries: PanelCardEntry[];
  onSelect: (itemId: string) => void;
};

/**
 * The panel of the capture devices of the trainer.
 *
 * The column is the information: the worst device is at the bottom and the
 * best on top, so the player sees the line of evolution of the devices even
 * without owning the best ones.
 */
export function DeviceSelectionPanel(props: DeviceSelectionPanelProps): ReactElement {
  const { entries, onSelect } = props;
  const subtitle = `Escolha o dispositivo do slot ${DEVICE_SLOT_NUMBER}.`;
  const content =
    entries.length === 0 ? (
      <Box height="18.75rem">
        <PanelState title={EMPTY_MESSAGE} variant="empty" />
      </Box>
    ) : (
      <PanelList entries={entries} onSelect={onSelect} />
    );
  return (
    <Box width={PANEL_WIDTH}>
      <Frame tone="overlay">
        <PanelHeader subtitle={subtitle} title="Dispositivos" />
        <Box padding="3">{content}</Box>
      </Frame>
    </Box>
  );
}
