import { Box } from '@chakra-ui/react';
import type { Creature } from '@creatures/contracts/creature';
import type { TeamSlot } from '@creatures/contracts/player';
import type { ReactElement } from 'react';

import { MAX_TEAM_SIZE } from '~/entities/team/model/team.constants';
import { NativeButton } from '~/shared/ui/button';
import { SLOT_SIZE, Slot } from '~/shared/ui/frame';

import { CreatureGlyph } from './CreatureGlyph';
import { CreatureTrigger } from './CreatureTrigger';

const ROW_HEIGHT = '3.5rem';
const ACTIVE_STATUS = 'Em campo';
const REMOVE_LABEL = 'Remover do time';

export type TeamSlotRowProps = {
  /** The creature in the field, the one the row highlights. */
  activeCreatureId: string | null;
  /** Whether a creature can leave the team. */
  canRemove: boolean;
  /** Whether the team is closed, which happens during the hunt. */
  isLocked: boolean;
  /** The command that takes a creature out of the team. */
  onRemove(creatureId: string): void;
  /** The creature the player clicked, the one whose slot is marked. */
  selectedId?: string | null;
  /** The click on a slot of the team, that marks the creature as chosen. */
  onSelect?(creatureId: string): void;
  /** The team, with the slot of each creature. */
  slots: TeamSlot[];
};

/**
 * The row of the team: the five slots, always, even the empty ones.
 *
 * The slot of a creature is the slot it occupies in the team, so a free slot
 * in the middle of the row stays empty instead of closing the gap: the row
 * shows the team as it is.
 *
 * The slot carries the mark of the creature and nothing else: the name, the
 * level and the attributes live in the popup.
 */
export function TeamSlotRow(props: TeamSlotRowProps): ReactElement {
  const { activeCreatureId, canRemove, isLocked, onRemove, onSelect, selectedId, slots } = props;
  const cells = buildCells(
    activeCreatureId,
    canRemove,
    isLocked,
    onRemove,
    onSelect,
    selectedId,
    slots,
  );
  return (
    <Box display="flex" gap="1" height={ROW_HEIGHT}>
      {cells}
    </Box>
  );
}

function buildCells(
  activeCreatureId: string | null,
  canRemove: boolean,
  isLocked: boolean,
  onRemove: (creatureId: string) => void,
  onSelect: ((creatureId: string) => void) | undefined,
  selectedId: string | null | undefined,
  slots: TeamSlot[],
): ReactElement[] {
  const cells: ReactElement[] = [];
  for (let index = 0; index < MAX_TEAM_SIZE; index += 1) {
    const slot = slots.find(function matchesSlot(entry: TeamSlot): boolean {
      return entry.slot === index + 1;
    });
    const creature = slot?.creature ?? null;
    const key = creature === null ? `empty-${index}` : creature.id;
    cells.push(
      <TeamSlotCell
        activeCreatureId={activeCreatureId}
        canRemove={canRemove}
        creature={creature}
        isLocked={isLocked}
        key={key}
        onRemove={onRemove}
        onSelect={onSelect}
        selectedId={selectedId}
      />,
    );
  }
  return cells;
}

type TeamSlotCellProps = {
  activeCreatureId: string | null;
  canRemove: boolean;
  creature: Creature | null;
  isLocked: boolean;
  onRemove(creatureId: string): void;
  onSelect?: (creatureId: string) => void;
  selectedId?: string | null;
};

function TeamSlotCell(props: TeamSlotCellProps): ReactElement {
  const { activeCreatureId, canRemove, creature, isLocked, onRemove, onSelect, selectedId } = props;
  if (creature === null) {
    return (
      <Box width={SLOT_SIZE}>
        <Slot empty />
      </Box>
    );
  }
  return (
    <CreatureSlot
      activeCreatureId={activeCreatureId}
      canRemove={canRemove}
      creature={creature}
      isLocked={isLocked}
      onRemove={onRemove}
      onSelect={onSelect}
      selectedId={selectedId}
    />
  );
}

type CreatureSlotProps = {
  activeCreatureId: string | null;
  canRemove: boolean;
  creature: Creature;
  isLocked: boolean;
  onRemove(creatureId: string): void;
  onSelect?: (creatureId: string) => void;
  selectedId?: string | null;
};

/**
 * The slot of a creature of the team.
 *
 * O clique abre o menu da criatura, e o menu e onde ela sai do time: o clique
 * no slot nunca muda o time sozinho. Sair do time vem primeiro, em tom comum,
 * porque e o que o jogador procura ali; o destructive vem por ultimo,
 * separado pelo divider.
 */
function CreatureSlot(props: CreatureSlotProps): ReactElement {
  const { activeCreatureId, canRemove, creature, isLocked, onRemove, onSelect, selectedId } = props;
  const creatureId = creature.id;
  const isActive = activeCreatureId === creatureId;
  const isSelected = selectedId === creatureId;
  const cursor = isLocked ? 'not-allowed' : 'pointer';

  function handleRemove(): void {
    if (isLocked) {
      return;
    }
    onRemove(creatureId);
  }

  function handleSelect(): void {
    if (isLocked) {
      return;
    }
    onSelect?.(creatureId);
  }

  const trigger = (
    <NativeButton cursor={cursor} onClick={handleSelect} width={SLOT_SIZE}>
      <Slot selected={isSelected}>
        <CreatureGlyph creature={creature} />
      </Slot>
    </NativeButton>
  );
  const status = isActive ? ACTIVE_STATUS : null;
  const actions = isLocked || !canRemove ? [] : [{ label: REMOVE_LABEL, onSelect: handleRemove }];
  return (
    <CreatureTrigger actions={actions} creature={creature} selected={isSelected} status={status}>
      {trigger}
    </CreatureTrigger>
  );
}
