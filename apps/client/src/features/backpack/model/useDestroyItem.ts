import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ApiDeps, DestroyItemClientErrorCode, DestroyItemCommandResult } from '~/shared/api';
import { createApiDeps, requestDestroyItem } from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

const ERROR_MESSAGES: Record<DestroyItemClientErrorCode, string> = {
  destroy_item_equipped: 'Não é possível destruir um item equipado.',
  destroy_item_internal_error: 'Não foi possível concluir a operação.',
  destroy_item_invalid_item: 'Item inválido.',
  destroy_item_not_in_backpack: 'O item não está na mochila.',
  destroy_item_request_in_flight:
    'A operação ainda está em andamento. Tente de novo em alguns instantes.',
  trainer_not_found: 'Treinador não encontrado.',
  unauthenticated: 'Sessão expirada. Entre de novo.',
  unknown: 'Não foi possível falar com o servidor.',
};

export type DestroyItemView = {
  destroyItem(itemId: string): void;
  isDestroying: boolean;
  error: string | null;
};

type DestroyIntent = {
  key: string | null;
  running: boolean;
};

type DestroyCommandRun = {
  controller: { current: AbortController | null };
  current: AbortController;
  deps: ApiDeps;
  intent: DestroyIntent;
  itemId: string;
  key: string;
  setError(value: string | null): void;
  setIsDestroying(value: boolean): void;
};

/**
 * The destruction of one unit of a backpack item.
 *
 * The command is fire-and-forget: the click starts it, and the server pushes
 * the new backpack to the screen. A failure never throws, it becomes the
 * message the modal shows.
 */
export function useDestroyItem(): DestroyItemView {
  const deps = useMemo(buildDeps, []);
  const [isDestroying, setIsDestroying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const intent = useRef<DestroyIntent>({ key: null, running: false });
  useEffect(function abortWhenTheScreenGoesAway(): () => void {
    return function abort(): void {
      controller.current?.abort();
    };
  }, []);
  const destroyItem = useCallback(
    function startDestroy(itemId: string): void {
      controller.current?.abort();
      const current = new globalThis.AbortController();
      controller.current = current;
      const key = beginIntent(intent.current);
      setIsDestroying(true);
      setError(null);
      void runDestroyCommand({
        controller,
        current,
        deps,
        intent: intent.current,
        itemId,
        key,
        setError,
        setIsDestroying,
      });
    },
    [deps],
  );
  return { destroyItem, error, isDestroying };
}

/**
 * Runs the command and turns its answer into the state of the hook.
 *
 * A newer command owns the state: the answer of an older one is dropped, so
 * two quick clicks do not show the result of the first over the second.
 */
function runDestroyCommand(run: DestroyCommandRun): Promise<void> {
  return Promise.resolve()
    .then(function send(): Promise<DestroyItemCommandResult> {
      return requestDestroyItem(run.deps, run.itemId, run.key, run.current.signal);
    })
    .catch(function afterFailure(): DestroyItemCommandResult {
      return { code: 'unknown', ok: false };
    })
    .then(function afterCommand(result: DestroyItemCommandResult): void {
      // The answer of an aborted command is not the answer of the screen: a
      // newer command already owns the state.
      if (run.current.signal.aborted) {
        return;
      }
      if (!result.ok) {
        run.setError(ERROR_MESSAGES[result.code] ?? ERROR_MESSAGES.unknown);
      }
      settleIntent(run.intent, result);
      if (run.controller.current === run.current) {
        run.setIsDestroying(false);
      }
    });
}

/**
 * The key of the command the player is running now.
 *
 * The key is born with the intent and dies with it: a new destruction is a new
 * key. The exception is the destruction the server is still running: that one
 * keeps its key, so the attempt that comes after is the same destruction and
 * not a second unit.
 */
function beginIntent(intent: DestroyIntent): string {
  let key = intent.key;
  if (key === null || intent.running) {
    key = createIntentKey();
    intent.key = key;
  }
  intent.running = true;
  return key;
}

/**
 * The answer of the server to the intent.
 *
 * A destruction the server is still running did not end: it keeps its key, so
 * the next click reads the result instead of destroying another unit.
 */
function settleIntent(intent: DestroyIntent, result: DestroyItemCommandResult): void {
  intent.running = false;
  if (result.ok || result.code !== 'destroy_item_request_in_flight') {
    intent.key = null;
  }
}

function createIntentKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildDeps(): ReturnType<typeof createApiDeps> {
  return createApiDeps(getAccessToken);
}
