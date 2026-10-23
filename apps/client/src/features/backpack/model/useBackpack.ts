import type { InventoryItem, ItemCategory } from '@creatures/contracts/inventory';
import { type ChangeEvent, useCallback, useState } from 'react';

export type BagFilter = 'Consumíveis' | 'Dispositivos' | 'Todos' | 'Variados';

/** The quick filters, in the order the interface shows them. */
export const BAG_FILTERS: readonly BagFilter[] = [
  'Todos',
  'Consumíveis',
  'Dispositivos',
  'Variados',
];

const FILTER_BY_CATEGORY: Record<Exclude<BagFilter, 'Todos'>, ItemCategory> = {
  Consumíveis: 'consumable',
  Dispositivos: 'device',
  Variados: 'material',
};

export type BackpackState = {
  filter: BagFilter;
  handleSearchChange(event: ChangeEvent<HTMLInputElement>): void;
  isSearching: boolean;
  /** Returns the backpack to the first open: aba Todos, busca vazia. */
  reset: () => void;
  search: string;
  setFilter(filter: BagFilter): void;
};

/**
 * The filter and the search of the backpack.
 *
 * The search always wins over the filter: typing resets the filter to Todos,
 * so the player never stays stuck in a tab without a result.
 *
 * A mochila nao tem selecao: o clique nao marca slot, porque slot de mochila
 * nao e alvo de acao nenhuma. Marcar slot e da loja e do armazenamento, onde
 * o slot escolhido entra na acao.
 */
export function useBackpack(): BackpackState {
  const [filter, setFilter] = useState<BagFilter>('Todos');
  const [search, setSearch] = useState('');

  const handleSearchChange = useCallback(function handleSearchChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    setSearch(event.target.value);
    setFilter('Todos');
  }, []);

  const reset = useCallback(function resetBackpack(): void {
    setSearch('');
    setFilter('Todos');
  }, []);

  return {
    filter,
    handleSearchChange,
    isSearching: search.trim() !== '',
    reset,
    search,
    setFilter,
  };
}

export function filterBackpackItems(
  items: InventoryItem[],
  filter: BagFilter,
  search: string,
): InventoryItem[] {
  const byCategory =
    filter === 'Todos' ? items : items.filter(matchesCategory(FILTER_BY_CATEGORY[filter]));
  const term = normalize(search);
  if (term === '') {
    return byCategory;
  }
  return byCategory.filter(function matches(item: InventoryItem): boolean {
    return normalize(item.name).includes(term);
  });
}

function matchesCategory(category: ItemCategory): (item: InventoryItem) => boolean {
  return function matches(item: InventoryItem): boolean {
    return item.category === category;
  };
}

/** The name without accents and in lower case, so "pocao" finds "Poção". */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036F]/gu, '')
    .trim()
    .toLowerCase();
}
