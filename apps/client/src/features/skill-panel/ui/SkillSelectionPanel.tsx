import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { PanelCardEntry } from '~/features/skill-panel/model/skillPanel.types';
import { PanelState } from '~/shared/ui/empty';
import { Frame } from '~/shared/ui/frame';

import { PANEL_WIDTH } from './panel.constants';
import { PanelHeader } from './PanelHeader';
import { PanelList } from './PanelList';

const EMPTY_MESSAGE = 'Nenhuma habilidade disponível';

type SkillSelectionPanelProps = {
  entries: PanelCardEntry[];
  onSelect: (abilityId: string) => void;
  slot: number;
};

/**
 * The panel of the abilities of the active creature.
 *
 * The list is the one of the species: an ability that is equipped in another
 * slot does not show up, because the same ability cannot be in two slots.
 */
export function SkillSelectionPanel(props: SkillSelectionPanelProps): ReactElement {
  const { entries, onSelect, slot } = props;
  const subtitle = `Seleciona a habilidade para o slot ${slot + 1}.`;
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
        <PanelHeader subtitle={subtitle} title="Habilidades" />
        <Box padding="3">{content}</Box>
      </Frame>
    </Box>
  );
}
