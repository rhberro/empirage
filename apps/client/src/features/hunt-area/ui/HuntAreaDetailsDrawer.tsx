import { Box } from '@chakra-ui/react';
import type { HuntAreaDetail } from '@creatures/contracts/hunt';
import type { ReactElement } from 'react';

import {
  huntAreaItemEntries,
  huntAreaSpeciesEntries,
} from '~/features/hunt-area/model/huntAreaEntries';
import type { HuntAreaStatus } from '~/features/hunt-area/model/useHuntAreaList';
import { HuntAreaGallery } from '~/features/hunt-area/ui/HuntAreaGallery';
import { HuntAreaHeader } from '~/features/hunt-area/ui/HuntAreaHeader';
import { StartHuntButton } from '~/features/hunt-area/ui/StartHuntButton';
import { Drawer, DrawerBody, DrawerFooter } from '~/shared/ui/drawer';
import { PanelState } from '~/shared/ui/empty';
import { ScrollArea } from '~/shared/ui/scroll';

const CREATURES_TITLE = 'Criaturas';
const ITEMS_TITLE = 'Itens';
const DRAWER_WIDTH = '23.75rem';
const DRAWER_HEIGHT = '45rem';
const LOADING_TITLE = 'Carregando os detalhes do local...';
const LOADING_DESCRIPTION = 'As criaturas e os itens da área estão chegando.';
const ERROR_TITLE = 'Não foi possível carregar os detalhes do local.';
const ERROR_DESCRIPTION = 'A leitura da área falhou. Feche o drawer e tente de novo.';

export type HuntAreaDetailsDrawerProps = {
  area: HuntAreaDetail | null;
  contained?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onStartHunt: (areaId: string) => Promise<boolean>;
  onStarted: () => void;
  staminaMinutes: number;
  status?: HuntAreaStatus;
};

/**
 * The drawer with the details of an area.
 *
 * It opens over the modal of the selection, so the player can close it and
 * choose another area without opening the modal again. The header and the
 * footer stay put, and only the body scrolls.
 */
export function HuntAreaDetailsDrawer(props: HuntAreaDetailsDrawerProps): ReactElement {
  const {
    area,
    contained = false,
    isOpen,
    onClose,
    onStartHunt,
    onStarted,
    staminaMinutes,
    status = 'ready',
  } = props;
  const label = area === null ? '' : area.name;
  const header = area === null ? null : <HuntAreaHeader area={area} />;
  const body = renderBody(area, status);
  const startDisabled = status !== 'ready' || area === null;
  const handleStart = buildStartHandler(area, onStartHunt, onStarted);

  return (
    <Drawer
      contained={contained}
      height={DRAWER_HEIGHT}
      isOpen={isOpen}
      label={label}
      onClose={onClose}
      width={DRAWER_WIDTH}
    >
      {header}
      <DrawerBody>
        <ScrollArea height="full">{body}</ScrollArea>
      </DrawerBody>
      <DrawerFooter>
        <StartHuntButton
          disabled={startDisabled}
          onStart={handleStart}
          staminaMinutes={staminaMinutes}
        />
      </DrawerFooter>
    </Drawer>
  );
}

function buildStartHandler(
  area: HuntAreaDetail | null,
  onStartHunt: (areaId: string) => Promise<boolean>,
  onStarted: () => void,
): () => Promise<boolean> {
  return function handleStart(): Promise<boolean> {
    if (area === null) {
      return Promise.resolve(false);
    }
    return onStartHunt(area.id).then(function afterStart(started: boolean): boolean {
      if (started) {
        onStarted();
      }
      return started;
    });
  };
}

function renderBody(area: HuntAreaDetail | null, status: HuntAreaStatus): ReactElement {
  if (status === 'loading') {
    return <PanelState description={LOADING_DESCRIPTION} title={LOADING_TITLE} variant="loading" />;
  }
  if (status === 'error' || area === null) {
    return <PanelState description={ERROR_DESCRIPTION} title={ERROR_TITLE} variant="error" />;
  }
  const creatures = huntAreaSpeciesEntries(area.species);
  const items = huntAreaItemEntries(area.items);
  return (
    <Box display="flex" flexDirection="column" gap="5">
      <HuntAreaGallery entries={creatures} title={CREATURES_TITLE} />
      <HuntAreaGallery entries={items} item title={ITEMS_TITLE} />
    </Box>
  );
}
