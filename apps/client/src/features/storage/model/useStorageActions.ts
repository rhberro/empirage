import type { TeamView } from '~/entities/team';

import { useCreatureRelease } from './useCreatureRelease';
import type { CreatureReleaseView } from './useCreatureRelease';

export type StorageActions = {
  /** Sends a creature to the team. */
  add(creatureId: string): void;
  /** The release of a creature, com a confirmacao. */
  release: CreatureReleaseView;
  /** Takes a creature out of the team. */
  remove(creatureId: string): void;
};

/**
 * The actions of the storage.
 *
 * As acoes do time moram aqui: o modal so desenha, e quem sabe o que cada
 * comando faz com o time do servidor e o time.
 */
export function useStorageActions(team: TeamView): StorageActions {
  const release = useCreatureRelease(handleRelease);

  function handleAdd(creatureId: string): void {
    void team.addToTeam(creatureId);
  }

  function handleRemove(creatureId: string): void {
    void team.removeFromTeam(creatureId);
  }

  function handleRelease(creatureId: string): void {
    void team.releaseCreature(creatureId);
  }

  return { add: handleAdd, release, remove: handleRemove };
}
