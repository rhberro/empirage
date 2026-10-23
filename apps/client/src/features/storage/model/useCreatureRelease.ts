import type { Creature } from '@creatures/contracts/creature';
import { useCallback, useState } from 'react';

import { readCreatureName } from '~/entities/team';

export type CreatureReleaseView = {
  /** Cancels the release. */
  cancel(): void;
  /** Confirms the release. */
  confirm(): void;
  /** Whether the confirmation is open. */
  isOpen: boolean;
  /** The name of the creature that is about to be released. */
  name: string;
  /** Asks for the release of a creature. */
  release(creature: Creature): void;
};

/**
 * The release of a creature of the storage.
 *
 * A liberacao e uma decisao: o jogador escolhe a criatura no menu, e a
 * confirmacao vem depois. O estado mora aqui, e a creature some do
 * armazenamento no instante em que a confirmacao acontece.
 */
export function useCreatureRelease(onRelease: (creatureId: string) => void): CreatureReleaseView {
  const [target, setTarget] = useState<Creature | null>(null);
  const isOpen = target !== null;
  const name = target === null ? '' : readCreatureName(target);

  const release = useCallback(function askRelease(creature: Creature): void {
    setTarget(creature);
  }, []);

  const cancel = useCallback(function cancelRelease(): void {
    setTarget(null);
  }, []);

  const confirm = useCallback(
    function confirmRelease(): void {
      const creature = target;
      setTarget(null);
      if (creature !== null) {
        onRelease(creature.id);
      }
    },
    [onRelease, target],
  );

  return { cancel, confirm, isOpen, name, release };
}
