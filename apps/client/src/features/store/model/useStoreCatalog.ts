import type { StoreBagItem, StoreCatalog, StoreItem } from '@creatures/contracts/store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createStoreIntent, type StoreIntentOutcome } from '~/features/store/model/storeIntent';
import { readStoreErrorMessage } from '~/features/store/model/storeMessages';
import type { ApiDeps, StoreCommandResult, StoreOutcome } from '~/shared/api';
import {
  createApiDeps,
  requestStoreBuy,
  requestStoreSell,
  STORE_CATALOG_QUERY_KEY,
  storeCatalogQueryOptions,
} from '~/shared/api';
import { getAccessToken } from '~/shared/auth';

export type StoreCatalogView = {
  /** The items of the backpack, grouped. */
  bag: StoreBagItem[];
  /** Buys the selected item. */
  buy: (itemId: string, quantity: number, onDone: (outcome: StoreOutcome) => void) => void;
  /** The items the store sells. */
  catalog: StoreItem[];
  /** The message of the last refusal of the server. */
  error: string | null;
  /** The gold the trainer has. */
  gold: number;
  /** The command is running: the button waits for the server. */
  isBusy: boolean;
  /** The catalog is loading. */
  isLoading: boolean;
  /** Sells a quantity of an item of the backpack. */
  sell: (itemId: string, quantity: number, onDone: (outcome: StoreOutcome) => void) => void;
};

type StoreCommand = (
  deps: ApiDeps,
  itemId: string,
  quantity: number,
  idempotencyKey: string,
  signal: AbortSignal,
) => Promise<StoreCommandResult>;

type StoreWallet = {
  bag: StoreBagItem[];
  gold: number;
};

/**
 * The catalog of the store and the wallet of the trainer.
 *
 * The server is the source of all of them: the modal reads the catalog when
 * it opens, and every command answers with the new wallet and the new
 * backpack.
 *
 * The catalog is a query: the answer mixes the content of the store with the
 * state of the player, and the command that changes the player leaves the
 * cache behind.
 */
export function useStoreCatalog(isOpen: boolean, snapshot: StoreCatalog | null): StoreCatalogView {
  const queryClient = useQueryClient();
  const deps = useMemo(buildDeps, []);
  const query = useQuery({
    ...storeCatalogQueryOptions(deps),
    enabled: isOpen && snapshot === null,
  });
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleWallet, setSampleWallet] = useState<StoreWallet | null>(null);
  const applyWallet = useStoreWallet(queryClient, snapshot, setSampleWallet);
  const buy = useStoreCommand(requestStoreBuy, deps, applyWallet, setIsBusy, setError);
  const sell = useStoreCommand(requestStoreSell, deps, applyWallet, setIsBusy, setError);
  const wallet = readWallet(query.data, snapshot, sampleWallet);

  return {
    bag: wallet.bag,
    buy,
    catalog: query.data?.items ?? snapshot?.items ?? [],
    error,
    gold: wallet.gold,
    isBusy,
    isLoading: snapshot === null && isOpen && query.isPending,
    sell,
  };
}

/**
 * Where the wallet of a command is written.
 *
 * The catalog that comes from outside — the gallery of the design system shows
 * the store with a catalog of samples — is not in the cache, so its wallet
 * lives in the screen.
 */
function useStoreWallet(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: StoreCatalog | null,
  setSampleWallet: (wallet: StoreWallet | null) => void,
): (outcome: StoreOutcome) => void {
  return useCallback(
    function applyOutcome(outcome: StoreOutcome): void {
      if (snapshot !== null) {
        setSampleWallet({ bag: outcome.bag, gold: outcome.gold });
        return;
      }
      writeWallet(queryClient, outcome);
    },
    [queryClient, setSampleWallet, snapshot],
  );
}

/**
 * A command of the store: the buy and the sale share the same shape.
 *
 * The command owns the key of the purchase: the key is born with the click and
 * dies with the operation, so a new click is a new purchase. The key lives
 * here and not in the transport because the transport only knows the request,
 * not the intent of the player.
 */
function useStoreCommand(
  command: StoreCommand,
  deps: ApiDeps,
  applyWallet: (outcome: StoreOutcome) => void,
  setIsBusy: (isBusy: boolean) => void,
  setError: (error: string | null) => void,
): (itemId: string, quantity: number, onDone: (outcome: StoreOutcome) => void) => void {
  const [intent] = useState(createStoreIntent);
  const controller = useRef<AbortController | null>(null);
  useEffect(function abortWhenTheScreenGoesAway(): () => void {
    return function abort(): void {
      controller.current?.abort();
    };
  }, []);
  return useCallback(
    function runCommand(
      itemId: string,
      quantity: number,
      onDone: (outcome: StoreOutcome) => void,
    ): void {
      setIsBusy(true);
      const key = intent.begin();
      controller.current?.abort();
      const current = new globalThis.AbortController();
      controller.current = current;
      command(deps, itemId, quantity, key, current.signal).then(function withOutcome(
        result: StoreCommandResult,
      ): void {
        const isCurrent = controller.current === current;
        if (isCurrent) {
          setIsBusy(false);
        }
        if (current.signal.aborted) {
          return;
        }
        intent.settle(readIntentOutcome(result));
        applyResult(result, applyWallet, setError, onDone);
      });
    },
    [applyWallet, command, deps, intent, setError, setIsBusy],
  );
}

/**
 * How the purchase of the command ended.
 *
 * A purchase the server is still running did not end: it keeps its key, so
 * the attempt that comes after is the same purchase.
 */
function readIntentOutcome(result: StoreCommandResult): StoreIntentOutcome {
  if (!result.ok && result.code === 'store_request_in_flight') {
    return 'in_flight';
  }
  return 'ended';
}

function buildDeps(): ApiDeps {
  return createApiDeps(getAccessToken);
}

function readWallet(
  catalog: StoreCatalog | undefined,
  snapshot: StoreCatalog | null,
  sampleWallet: StoreWallet | null,
): StoreWallet {
  if (sampleWallet !== null) {
    return sampleWallet;
  }
  if (catalog !== undefined) {
    return { bag: catalog.bag, gold: catalog.gold };
  }
  return { bag: snapshot?.bag ?? [], gold: snapshot?.gold ?? 0 };
}

/**
 * The answer of a command: the new wallet and the new backpack, or the reason
 * of the refusal.
 *
 * The wallet is written right away, and the server is asked again: the answer
 * of the command is what the player sees, and the answer of the server is what
 * stays.
 */
function applyResult(
  result: StoreCommandResult,
  applyWallet: (outcome: StoreOutcome) => void,
  setError: (error: string | null) => void,
  onDone: (outcome: StoreOutcome) => void,
): void {
  if (!result.ok) {
    setError(readStoreErrorMessage(result.code));
    return;
  }
  applyWallet(result.outcome);
  setError(null);
  onDone(result.outcome);
}

function writeWallet(queryClient: ReturnType<typeof useQueryClient>, outcome: StoreOutcome): void {
  queryClient.setQueryData<StoreCatalog>(
    STORE_CATALOG_QUERY_KEY,
    function withWallet(catalog: StoreCatalog | undefined): StoreCatalog | undefined {
      if (catalog === undefined) {
        return catalog;
      }
      return { ...catalog, bag: outcome.bag, gold: outcome.gold };
    },
  );
  void queryClient.invalidateQueries({ queryKey: STORE_CATALOG_QUERY_KEY });
}
