import { HuntTeamMemberActor } from '@creatures/contracts/huntSim';

import { HuntStoreState, useHuntStateShallow } from '~/entities/hunt';

type CreatureAt = Partial<HuntTeamMemberActor> | undefined;

export function useCreatureAt(position: number): CreatureAt {
  function getCurrentCreatureAtPosition(state: HuntStoreState): CreatureAt {
    if (!state || !state.snapshot) {
      return undefined;
    }
    const creature = state.snapshot.team[position];
    if (!creature) {
      return undefined;
    }
    const { level, speciesName } = creature;
    return { level, speciesName };
  }
  return useHuntStateShallow(getCurrentCreatureAtPosition);
}
