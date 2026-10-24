import type { ReactElement } from 'react';

import { selectHuntPhase, useHuntState } from '~/entities/hunt';
import { BackpackModal } from '~/features/backpack';
import { StorageModal } from '~/features/storage';
import { StoreModal } from '~/features/store';
import type { GameModalsView } from '~/pages/play/model/useGameSession';

type GameModalsProps = {
  modals: GameModalsView;
};

/**
 * The modals of the game screen.
 *
 * They live here so the screen stays a screen: the state of each modal lives
 * in the session, and this component only draws them.
 */
export function GameModals(props: GameModalsProps): ReactElement {
  const { modals } = props;
  const phase = useHuntState(selectHuntPhase);
  const isHunting = phase === 'entering' || phase === 'active' || phase === 'leaving';
  return (
    <>
      <BackpackModal isOpen={modals.isBackpackOpen} onClose={modals.onCloseBackpack} />
      <StorageModal
        isHunting={isHunting}
        isOpen={modals.isStorageOpen}
        onClose={modals.onCloseStorage}
      />
      <StoreModal isOpen={modals.isStoreOpen} onClose={modals.onCloseStore} />
    </>
  );
}
