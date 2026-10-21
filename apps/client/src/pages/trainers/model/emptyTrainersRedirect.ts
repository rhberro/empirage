import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';

const NEW_TRAINER_PATH = '/trainers/new';

/**
 * A conta sem treinador vai para a tela que cria um.
 *
 * A decisão mora aqui porque a lista é lida por uma query: quem descobre que
 * a lista está vazia é a tela, e é ela que sabe o que fazer com isso.
 */
export function useEmptyTrainersRedirect(
  isLoaded: boolean,
  count: number,
  navigate: NavigateFunction,
): void {
  const isEmpty = isLoaded && count === 0;
  useEffect(buildRedirectEffect(isEmpty, navigate), [isEmpty, navigate]);
}

function buildRedirectEffect(isEmpty: boolean, navigate: NavigateFunction): () => void {
  return function redirectToNewTrainer(): void {
    if (!isEmpty) {
      return;
    }
    navigate(NEW_TRAINER_PATH, { replace: true });
  };
}
