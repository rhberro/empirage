import type { Trainer } from '@creatures/contracts/trainer';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { TrainersPanel, useTrainers } from '~/entities/trainer';
import { useEmptyTrainersRedirect } from '~/pages/trainers/model/emptyTrainersRedirect';
import { requestEnterTrainer } from '~/pages/trainers/model/enterTrainer';
import { findTrainerName as resolveTrainerName } from '~/pages/trainers/model/trainerSelection';
import type {
  DeleteTrainerResult,
  SessionTrainerResult,
  TrainerClientErrorCode,
} from '~/shared/api';
import { useAuth } from '~/shared/auth';
import { BrandLayout } from '~/shared/ui/brand';

import { PageError } from './PageError';
import { TrainerDeleteSection } from './TrainerDeleteSection';

const SIGNIN_PATH = '/signin';
const GAME_PATH = '/game';
const NEW_TRAINER_PATH = '/trainers/new';

export function TrainersPage(): ReactElement {
  const auth = useAuth();
  const navigate = useNavigate();
  const { trainers, isLoading, error, isLoaded, remove, selectedTrainerId, selectTrainer } =
    useTrainers();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [enterError, setEnterError] = useState<TrainerClientErrorCode | null>(null);
  const isEntering = useRef(false);
  useEmptyTrainersRedirect(isLoaded, trainers.length, navigate);
  const handlers = buildPageHandlers({
    enterTrainer: requestEnterTrainer,
    isEntering,
    navigate,
    pendingDeleteId,
    remove,
    selectTrainer,
    selectedId: selectedTrainerId,
    setEnterError,
    setIsDeleting,
    setPendingDeleteId,
    signOut: auth.signOut,
  });
  const isDeleteOpen = pendingDeleteId !== null;

  return (
    <BrandLayout>
      <TrainersCard
        enterError={enterError}
        error={error}
        handlers={handlers}
        isDeleting={isDeleting}
        isDeleteOpen={isDeleteOpen}
        isLoading={isLoading}
        pendingDeleteId={pendingDeleteId}
        selectedId={selectedTrainerId}
        trainers={trainers}
      />
    </BrandLayout>
  );
}

function TrainersCard(props: TrainersCardProps): ReactElement {
  const {
    enterError,
    error,
    handlers,
    isDeleting,
    isDeleteOpen,
    isLoading,
    pendingDeleteId,
    selectedId,
    trainers,
  } = props;
  const pendingTrainerName = findTrainerName(trainers, pendingDeleteId);

  const errorMessage = buildErrorMessage(error, enterError);

  return (
    <>
      <TrainersPanel
        error={errorMessage}
        isLoading={isLoading}
        selectedId={selectedId}
        trainers={trainers}
        onCreate={handlers.handleCreate}
        onDelete={handlers.handleRequestDelete}
        onEnter={handlers.handleEnter}
        onSelect={handlers.handleSelect}
        onSignOut={handlers.handleSignOut}
      />
      <TrainerDeleteSection
        isDeleting={isDeleting}
        isOpen={isDeleteOpen}
        trainerName={pendingTrainerName}
        onCancel={handlers.handleCancelDelete}
        onConfirm={handlers.handleConfirmDelete}
      />
    </>
  );
}

type TrainersCardProps = {
  enterError: TrainerClientErrorCode | null;
  error: TrainerClientErrorCode | null;
  handlers: PageHandlers;
  isDeleting: boolean;
  isDeleteOpen: boolean;
  isLoading: boolean;
  pendingDeleteId: string | null;
  selectedId: string | null;
  trainers: Trainer[];
};

type PageHandlers = {
  handleCancelDelete: () => void;
  handleConfirmDelete: () => void;
  handleCreate: () => void;
  handleEnter: () => void;
  handleRequestDelete: (id: string) => void;
  handleSelect: (id: string) => void;
  handleSignOut: () => void;
};

type PageHandlerDeps = {
  enterTrainer: (trainerId: string) => Promise<SessionTrainerResult>;
  isEntering: { current: boolean };
  navigate: NavigateFunction;
  pendingDeleteId: string | null;
  remove: (id: string) => Promise<DeleteTrainerResult>;
  selectedId: string | null;
  selectTrainer: (id: string | null) => void;
  setEnterError: (code: TrainerClientErrorCode | null) => void;
  setPendingDeleteId: (id: string | null) => void;
  setIsDeleting: (value: boolean) => void;
  signOut: () => Promise<void>;
};

function buildPageHandlers(deps: PageHandlerDeps): PageHandlers {
  return {
    handleCancelDelete: buildCancelDeleteHandler(deps.setPendingDeleteId),
    handleConfirmDelete: buildConfirmDeleteHandler(deps),
    handleCreate: buildNavigateHandler(deps.navigate, NEW_TRAINER_PATH),
    handleEnter: buildEnterHandler(deps),
    handleRequestDelete: buildRequestDeleteHandler(deps.setPendingDeleteId),
    handleSelect: buildSelectHandler(deps.selectTrainer, deps.selectedId, deps.setEnterError),
    handleSignOut: buildSignOutHandler(deps.navigate, deps.signOut),
  };
}

function buildNavigateHandler(navigate: NavigateFunction, path: string): () => void {
  return function handleNavigate(): void {
    navigate(path);
  };
}

/**
 * Entering is the moment the server learns which trainer the account is
 * playing with. The screen of the game only opens when the server accepts it.
 */
function buildEnterHandler(deps: PageHandlerDeps): () => void {
  return function handleEnter(): void {
    const trainerId = deps.selectedId;
    if (trainerId === null || deps.isEntering.current) {
      return;
    }
    deps.isEntering.current = true;
    deps.setEnterError(null);
    deps.enterTrainer(trainerId).then(buildEnterSettler(deps), buildEnterSettler(deps));
  };
}

function buildEnterSettler(deps: PageHandlerDeps): (result: SessionTrainerResult) => void {
  return function settleEnter(result: SessionTrainerResult): void {
    deps.isEntering.current = false;
    if (result.ok) {
      deps.navigate(GAME_PATH);
      return;
    }
    deps.setEnterError(result.code);
  };
}

function buildRequestDeleteHandler(setPendingDeleteId: (id: string) => void): (id: string) => void {
  return function handleRequestDelete(id: string): void {
    setPendingDeleteId(id);
  };
}

function buildCancelDeleteHandler(setPendingDeleteId: (id: string | null) => void): () => void {
  return function handleCancelDelete(): void {
    setPendingDeleteId(null);
  };
}

function buildConfirmDeleteHandler(deps: PageHandlerDeps): () => void {
  return function handleConfirmDelete(): void {
    const id = deps.pendingDeleteId;
    if (id === null) {
      return;
    }
    deps.setIsDeleting(true);
    deps.remove(id).then(buildDeleteSettler(deps), buildDeleteSettler(deps));
  };
}

function buildDeleteSettler(deps: PageHandlerDeps): (result: DeleteTrainerResult) => void {
  return function settleDelete(): void {
    const id = deps.pendingDeleteId;
    deps.setIsDeleting(false);
    deps.setPendingDeleteId(null);
    deps.selectTrainer(buildSelectionClearer(id)(deps.selectedId));
  };
}

function buildSelectHandler(
  selectTrainer: (id: string | null) => void,
  selectedId: string | null,
  setEnterError: (code: TrainerClientErrorCode | null) => void,
): (id: string) => void {
  return function handleSelect(id: string): void {
    setEnterError(null);
    selectTrainer(buildSelectionToggler(id)(selectedId));
  };
}

function buildSelectionToggler(id: string): (current: string | null) => string | null {
  return function toggle(current: string | null): string | null {
    return current === id ? null : id;
  };
}

function buildSelectionClearer(id: string | null): (current: string | null) => string | null {
  return function clear(current: string | null): string | null {
    return current === id ? null : current;
  };
}

function buildSignOutHandler(navigate: NavigateFunction, signOut: () => Promise<void>): () => void {
  return function handleSignOut(): void {
    signOut().then(buildSigninRedirect(navigate), noop);
  };
}

function buildSigninRedirect(navigate: NavigateFunction): () => void {
  return function redirect(): void {
    navigate(SIGNIN_PATH, { replace: true });
  };
}

function noop(): void {
  void 0;
}

function buildErrorMessage(
  listError: TrainerClientErrorCode | null,
  enterError: TrainerClientErrorCode | null,
): ReactElement | null {
  if (enterError !== null) {
    return <PageError code={enterError} context="enter" />;
  }
  if (listError === null) {
    return null;
  }
  return <PageError code={listError} />;
}

function findTrainerName(trainers: Trainer[], pendingDeleteId: string | null): string {
  return resolveTrainerName(trainers, pendingDeleteId);
}
