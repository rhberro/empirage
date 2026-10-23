import { Box, Spinner } from '@chakra-ui/react';
import type { Trainer } from '@creatures/contracts/trainer';
import type { ReactElement } from 'react';

import { Button } from '~/shared/ui/button';
import { Frame, FrameHeader } from '~/shared/ui/frame';

import { CreateTrainerCard } from './CreateTrainerCard';
import { TrainerList } from './TrainerList';

const TITLE = 'Lista de Treinadores';
const ENTER_LABEL = 'Entrar';
const SIGN_OUT_LABEL = 'Sair da conta';
const MAX_TRAINERS = 5;
const PANEL_WIDTH = '26.25rem';

type TrainersPanelProps = {
  error?: ReactElement | null;
  isLoading: boolean;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onEnter: () => void;
  onSelect: (id: string) => void;
  onSignOut: () => void;
  selectedId: string | null;
  trainers: Trainer[];
};

export function TrainersPanel(props: TrainersPanelProps): ReactElement {
  const {
    error,
    isLoading,
    onCreate,
    onDelete,
    onEnter,
    onSelect,
    onSignOut,
    selectedId,
    trainers,
  } = props;
  const isEnterDisabled = selectedId === null || isLoading;
  const list = isLoading ? (
    <Spinner alignSelf="center" color="fg.muted" />
  ) : (
    <TrainerList
      selectedId={selectedId}
      trainers={trainers}
      onDelete={onDelete}
      onSelect={onSelect}
    />
  );
  const createCard =
    trainers.length < MAX_TRAINERS ? <CreateTrainerCard onCreate={onCreate} /> : null;

  return (
    <Box width={PANEL_WIDTH}>
      <Frame tone="overlay">
        <FrameHeader>{TITLE}</FrameHeader>
        <Box display="flex" flexDirection="column" gap="4" padding="4">
          {list}
          {createCard}
          {error}
          <Button tone="primary" disabled={isEnterDisabled} onClick={onEnter}>
            {ENTER_LABEL}
          </Button>
          <Button tone="secondary" onClick={onSignOut}>
            {SIGN_OUT_LABEL}
          </Button>
        </Box>
      </Frame>
    </Box>
  );
}
