/* eslint-disable import/max-dependencies */
import { Button } from '@chakra-ui/react';

import { Icon } from '~/shared/ui/Icon';

import type { CollectionStateEvent } from '../api/game-protocol';
import type { CharacterProfile } from '../api/game-protocol';
import { HuntCommand, HuntState } from '../api/hunt-protocol';
import { toggleStorageModal } from '../model/modal-store';
import { BottomBar } from './BottomBar';
import { CreatureStorageDialog } from './CreatureStorageDialog';
import { HuntControls } from './HuntControls';
import { HuntStatusPanels } from './HuntStatusPanels';

type HuntInterfaceProps = {
  collection: CollectionStateEvent['collection'] | null;
  hunt: HuntState | null;
  profile: CharacterProfile | null;
  sendHuntCommand: (command: HuntCommand) => boolean;
};

export function HuntInterface(props: HuntInterfaceProps): React.ReactElement {
  const { collection, hunt, profile, sendHuntCommand } = props;
  const activeCreatureId = hunt ? hunt.activeCreatureId : undefined;
  const huntInterface = hunt ? <HuntControls hunt={hunt} onCommand={sendHuntCommand} /> : null;
  return (
    <>
      <HuntStatusPanels
        collection={collection}
        hunt={hunt}
        onCommand={sendHuntCommand}
        profile={profile}
      />
      <Button
        aria-label="Abrir armazenamento"
        left="50%"
        onClick={toggleStorageModal}
        position="fixed"
        top="3"
        transform="translateX(-50%)"
        zIndex="2"
      >
        <Icon name="inventory_2" />
        Armazenamento
      </Button>
      <BottomBar hunt={hunt} onCommand={sendHuntCommand} />
      <CreatureStorageDialog
        activeCreatureId={activeCreatureId}
        collection={collection}
        onCommand={sendHuntCommand}
      />
      {huntInterface}
    </>
  );
}
