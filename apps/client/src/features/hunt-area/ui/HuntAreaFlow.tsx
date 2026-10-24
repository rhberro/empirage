import type { HuntArea } from '@creatures/contracts/hunt';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { useHuntAreaDetail } from '~/features/hunt-area/model/useHuntAreaDetail';
import { useHuntAreaList } from '~/features/hunt-area/model/useHuntAreaList';
import { HuntAreaDetailsDrawer } from '~/features/hunt-area/ui/HuntAreaDetailsDrawer';
import { HuntAreaSelectModal } from '~/features/hunt-area/ui/HuntAreaSelectModal';

export type HuntAreaFlowProps = {
  isOpen: boolean;
  onClose: () => void;
  onStartHunt: (areaId: string) => Promise<boolean>;
  staminaMinutes: number;
};

/**
 * The two layers of the hunt areas.
 *
 * The modal lists the areas and the drawer shows the one the player selected.
 * The drawer opens over the modal, and closing it takes the player back to
 * the list, in the same place.
 */
export function HuntAreaFlow(props: HuntAreaFlowProps): ReactElement {
  const { isOpen, onClose, onStartHunt, staminaMinutes } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useHuntAreaList(isOpen);
  const detail = useHuntAreaDetail(selectedId);
  const detailsOpen = selectedId !== null;

  function handleSelect(area: HuntArea): void {
    setSelectedId(area.id);
  }

  function handleCloseDetails(): void {
    setSelectedId(null);
  }

  function handleStarted(): void {
    setSelectedId(null);
    onClose();
  }

  return (
    <>
      <HuntAreaSelectModal
        areas={list.areas}
        isOpen={isOpen}
        onClose={onClose}
        onSelect={handleSelect}
        status={list.status}
      />
      <HuntAreaDetailsDrawer
        area={detail.area}
        isOpen={detailsOpen}
        onClose={handleCloseDetails}
        onStartHunt={onStartHunt}
        onStarted={handleStarted}
        staminaMinutes={staminaMinutes}
        status={detail.status}
      />
    </>
  );
}
