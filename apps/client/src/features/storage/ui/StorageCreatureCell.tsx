import type { Creature } from '@creatures/contracts/creature';
import type { ReactElement } from 'react';

import { CreatureGlyph, CreatureTrigger } from '~/entities/team';
import { NativeButton } from '~/shared/ui/button';
import { SLOT_SIZE, Slot } from '~/shared/ui/frame';

const ADD_LABEL = 'Adicionar ao time';
const RELEASE_LABEL = 'Soltar criatura';

type StorageCreatureCellProps = {
  /** Whether the creature can be released: there is another one in the account. */
  canRelease: boolean;
  creature: Creature;
  /** Whether the team is closed, which happens during the hunt. */
  isLocked: boolean;
  /** Whether the slot is the one the player clicked. */
  isSelected: boolean;
  onAdd(creatureId: string): void;
  /** The click on the slot, that marks the creature as chosen. */
  onSelect(creatureId: string): void;
  /** The action that releases the creature from the storage. */
  onRelease(creature: Creature): void;
};

/**
 * A captured creature: the mark of the species and the command that sends it
 * to the team.
 *
 * The slot carries the mark and nothing else: the name, the level and os
 * atributos vivem no popup. O clique abre o menu com as acoes da criatura, e
 * nenhuma delas acontece por acidente: o toque no slot nao coloca a criatura
 * no time.
 */
export function StorageCreatureCell(props: StorageCreatureCellProps): ReactElement {
  const { canRelease, creature, isLocked, isSelected, onAdd, onRelease, onSelect } = props;
  const creatureId = creature.id;

  function handleAdd(): void {
    if (isLocked) {
      return;
    }
    onAdd(creatureId);
  }

  function handleRelease(): void {
    if (isLocked) {
      return;
    }
    onRelease(creature);
  }

  const cursor = isLocked ? 'not-allowed' : 'pointer';
  const handleClick = buildClick(onSelect, creatureId);
  const trigger = (
    <NativeButton cursor={cursor} onClick={handleClick} width={SLOT_SIZE}>
      <Slot selected={isSelected}>
        <CreatureGlyph creature={creature} />
      </Slot>
    </NativeButton>
  );
  const actions = [
    { label: ADD_LABEL, onSelect: handleAdd },
    ...(canRelease
      ? [{ label: RELEASE_LABEL, onSelect: handleRelease, tone: 'danger' as const }]
      : []),
  ];
  return (
    <CreatureTrigger actions={actions} creature={creature} selected={isSelected}>
      {trigger}
    </CreatureTrigger>
  );
}

/**
 * The click on the slot: it marks the creature as chosen.
 */
function buildClick(onSelect: (creatureId: string) => void, creatureId: string): () => void {
  return function click(): void {
    onSelect(creatureId);
  };
}
