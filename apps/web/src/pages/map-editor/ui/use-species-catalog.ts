/* eslint-disable oxsome/no-inline-structural-types */
import { useEffect, useState } from 'react';

import { getSpeciesCatalog } from '~/entities/hunting-location';

import type { SpeciesCatalogItem } from './types';

const INITIAL_CATALOG: Array<SpeciesCatalogItem> = [];

export function useSpeciesCatalog(): Array<SpeciesCatalogItem> {
  const [catalog, setCatalog] = useState<Array<SpeciesCatalogItem>>(INITIAL_CATALOG);

  function loadCatalogEffect(): () => void {
    let mounted = true;

    function handleCatalog(data: Array<SpeciesCatalogItem>): void {
      if (mounted) {
        setCatalog(data);
      }
    }

    function handleError(): void {
      if (mounted) {
        setCatalog(INITIAL_CATALOG);
      }
    }

    const promise = getSpeciesCatalog();
    promise.then(handleCatalog).catch(handleError);

    function cleanup(): void {
      mounted = false;
    }
    return cleanup;
  }

  useEffect(loadCatalogEffect, []);

  return catalog;
}
