import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import type { PanelCardEntry } from '~/features/skill-panel/model/skillPanel.types';
import { ScrollArea } from '~/shared/ui/scroll';

import { PanelCard } from './PanelCard';

const LIST_MAX_HEIGHT = '18.75rem';

type PanelListProps = {
  entries: PanelCardEntry[];
  onSelect: (id: string) => void;
};

/**
 * The list of items of a panel of selection.
 *
 * The three panels share the same list: the same cards, the same gap and the
 * same height. What changes between them is the data of the card, not the
 * shape of the list.
 */
export function PanelList(props: PanelListProps): ReactElement {
  const { entries, onSelect } = props;
  const cards = entries.map(renderCard(onSelect));
  return (
    <ScrollArea maxH={LIST_MAX_HEIGHT}>
      <Box display="flex" flexDirection="column" gap="2">
        {cards}
      </Box>
    </ScrollArea>
  );
}

function renderCard(onSelect: (id: string) => void): (entry: PanelCardEntry) => ReactElement {
  return function render(entry: PanelCardEntry): ReactElement {
    return <PanelCard entry={entry} key={entry.id} onSelect={onSelect} />;
  };
}
