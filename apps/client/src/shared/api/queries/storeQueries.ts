import type { StoreCatalog } from '@creatures/contracts/store';
import type { UseQueryOptions } from '@tanstack/react-query';

import type { ApiDeps } from '~/shared/api/client';
import type { StoreCatalogResult } from '~/shared/api/endpoints/store';
import { requestStoreCatalog } from '~/shared/api/endpoints/store';
import { ApiRequestError } from '~/shared/api/http';

/**
 * The key of the catalog of the store.
 */
export const STORE_CATALOG_QUERY_KEY = ['store', 'catalog'] as const;

export type StoreCatalogQueryOptions = UseQueryOptions<
  StoreCatalog,
  Error,
  StoreCatalog,
  typeof STORE_CATALOG_QUERY_KEY
>;

/**
 * The catalog of the store, with the backpack and the gold of the trainer.
 *
 * The answer mixes the content of the store with the state of the player, and
 * the two change at different speeds. Until the server separates them, the
 * catalog is never stale on its own: it is invalidated by the command that
 * changed it.
 */
export function storeCatalogQueryOptions(deps: ApiDeps): StoreCatalogQueryOptions {
  return {
    queryFn: fetchStoreCatalog(deps),
    queryKey: STORE_CATALOG_QUERY_KEY,
    staleTime: 0,
  };
}

function fetchStoreCatalog(deps: ApiDeps): () => Promise<StoreCatalog> {
  return function fetchCatalog(): Promise<StoreCatalog> {
    return requestStoreCatalog(deps).then(readStoreCatalog);
  };
}

function readStoreCatalog(result: StoreCatalogResult): StoreCatalog {
  if (!result.ok) {
    throw new ApiRequestError(result.code);
  }
  return result.catalog;
}
