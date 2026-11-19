import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';
import type { HuntCommand } from '../../api/hunt-protocol';
import { selectActiveCreatureId, selectParty, useGameStore } from '../../model/game-store';
import { HuntPartyCard } from './HuntPartyCard';
import { SwitchCooldown } from './SwitchCooldown';

type PartyStatusProps = { onCommand: (command: HuntCommand) => boolean };
type Party = Array<CollectionCreature>;

function partyForDisplay(party: Party, activeCreatureId: string | null | undefined): Party {
  function isActiveCreature(creature: CollectionCreature): boolean {
    return creature.id === activeCreatureId;
  }
  const activeCreature = party.find(isActiveCreature);
  if (!activeCreature) {
    return party;
  }
  function isRemainingCreature(creature: CollectionCreature): boolean {
    return creature.id !== activeCreature.id;
  }
  const remainingParty = party.filter(isRemainingCreature);
  return [activeCreature, ...remainingParty];
}

export function PartyStatus(props: PartyStatusProps): React.ReactElement {
  const { onCommand } = props;
  const activeCreatureId = useGameStore(selectActiveCreatureId);
  const party = useGameStore(selectParty);
  const displayedParty = partyForDisplay(party, activeCreatureId);

  function renderPartyCard(creature: CollectionCreature): React.ReactElement {
    const isActive = creature.id === activeCreatureId;
    return (
      <HuntPartyCard
        creature={creature}
        isActive={isActive}
        key={creature.id}
        onCommand={onCommand}
      />
    );
  }

  const partyCards = displayedParty.map(renderPartyCard);

  return (
    <div className="hunt-status__party">
      <SwitchCooldown />
      {partyCards}
    </div>
  );
}
