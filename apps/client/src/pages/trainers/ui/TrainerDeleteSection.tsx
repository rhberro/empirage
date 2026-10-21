import type { ReactElement } from 'react';

import { TrainerDeleteDialog } from '~/features/delete-trainer';

type TrainerDeleteSectionProps = {
  isDeleting: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  trainerName: string;
};

/**
 * The confirmation of the exclusion of a trainer.
 */
export function TrainerDeleteSection(props: TrainerDeleteSectionProps): ReactElement {
  const { isDeleting, isOpen, onCancel, onConfirm, trainerName } = props;
  return (
    <TrainerDeleteDialog
      isDeleting={isDeleting}
      isOpen={isOpen}
      trainerName={trainerName}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
