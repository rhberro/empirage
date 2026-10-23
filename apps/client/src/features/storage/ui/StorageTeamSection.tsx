import { Box } from '@chakra-ui/react';
import type { TeamSlot } from '@creatures/contracts/player';
import type { ReactElement } from 'react';

import { TeamSlotRow } from '~/entities/team';
import { TEAM_LABEL } from '~/features/storage/ui/storageModal.constants';
import { Text } from '~/shared/ui/text';

type StorageTeamSectionProps = {
  /** The creature in the field, the one the row highlights. */
  activeCreatureId: string | null;
  /** Whether the team is closed, which happens during the hunt. */
  isLocked: boolean;
  /** The command that takes a creature out of the team. */
  onRemove(creatureId: string): void;
  /** The click on a slot of the team, that marks the creature as chosen. */
  onSelect?(creatureId: string): void;
  reason: string | null;
  /** The creature the player clicked, the one whose slot is marked. */
  selectedId?: string | null;
  /** The team, with the slot of each creature. */
  slots: TeamSlot[];
};

/**
 * The section of the team: the five slots, always, even the empty ones.
 *
 * The section has a fixed height and does not scroll: it always shows the
 * same five slots. The click opens the menu of the creature, and it is in the
 * menu that it leaves the team: nothing happens by accident.
 */
export function StorageTeamSection(props: StorageTeamSectionProps): ReactElement {
  const { activeCreatureId, isLocked, onRemove, onSelect, reason, selectedId, slots } = props;
  const reasonText = buildReason(reason);
  const label = (
    <Box alignItems="center" display="flex" gap="3" justifyContent="space-between">
      <Text color="fg.muted" variant="label">
        {TEAM_LABEL}
      </Text>
      {reasonText}
    </Box>
  );
  const row = (
    <TeamSlotRow
      activeCreatureId={activeCreatureId}
      isLocked={isLocked}
      onRemove={onRemove}
      onSelect={onSelect}
      selectedId={selectedId}
      slots={slots}
    />
  );
  return (
    <Box>
      {label}
      <Box marginBlockStart="2">{row}</Box>
    </Box>
  );
}

/**
 * The reason why the actions are blocked, shown where the player looks for
 * the team.
 */
function buildReason(reason: string | null): ReactElement | null {
  if (reason === null) {
    return null;
  }
  return (
    <Text color="fg.warning" variant="meta">
      {reason}
    </Text>
  );
}
