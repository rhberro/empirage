import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { PanelCardEntry } from '~/features/skill-panel/model/skillPanel.types';
import { PanelState } from '~/shared/ui/empty';
import { Frame } from '~/shared/ui/frame';

import { PANEL_WIDTH } from './panel.constants';
import { PanelHeader } from './PanelHeader';
import { PanelList } from './PanelList';
import { TriggerControl } from './TriggerControl';

const EMPTY_MESSAGE = 'Nenhum consumível na mochila';

type ConsumableSelectionPanelProps = {
  entries: PanelCardEntry[];
  onSelect: (itemId: string) => void;
  onTriggerChange: (percent: number) => void;
  slot: number;
  triggerHpPercent: number;
};

/**
 * The panel of the consumables of the trainer.
 *
 * The list is the whole catalog, not only the backpack: the quantity is what
 * changes the interaction, not what shows up. The strongest consumable is on
 * top and the weakest at the bottom.
 */
export function ConsumableSelectionPanel(props: ConsumableSelectionPanelProps): ReactElement {
  const { entries, onSelect, onTriggerChange, slot, triggerHpPercent } = props;
  const subtitle = `Escolha o consumível do slot ${slot + 1}.`;
  const isEmpty = entries.length === 0;
  const content = isEmpty ? (
    <Box height="18.75rem">
      <PanelState title={EMPTY_MESSAGE} variant="empty" />
    </Box>
  ) : (
    <>
      <TriggerControl onChange={onTriggerChange} percent={triggerHpPercent} />
      <Box marginBlockStart="3">
        <PanelList entries={entries} onSelect={onSelect} />
      </Box>
    </>
  );
  return (
    <Box width={PANEL_WIDTH}>
      <Frame tone="overlay">
        <PanelHeader subtitle={subtitle} title="Consumíveis" />
        <Box padding="3">{content}</Box>
      </Frame>
    </Box>
  );
}
