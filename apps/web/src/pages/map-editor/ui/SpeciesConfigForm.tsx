/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

import { SpeciesSlotCard } from './SpeciesSlotCard';
import type { HuntingLocationSpecies, SpeciesCatalogItem } from './types';

export interface SpeciesConfigFormProps {
  catalog: Array<SpeciesCatalogItem>;
  initialSpecies: Array<HuntingLocationSpecies>;
  onClose: () => void;
  onSave: (species: Array<HuntingLocationSpecies>) => void;
}

const SEARCH_INPUT_STYLE: React.CSSProperties = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '4px',
  color: 'white',
  fontSize: '12px',
  padding: '6px 10px',
  width: '280px',
};

function buildInitialMap(
  initialSpecies: Array<HuntingLocationSpecies>,
): Map<number, HuntingLocationSpecies> {
  const map = new Map<number, HuntingLocationSpecies>();
  for (const sp of initialSpecies) {
    map.set(sp.id, { ...sp });
  }
  return map;
}

function filterCatalogItems(
  catalog: Array<SpeciesCatalogItem>,
  searchTerm: string,
): Array<SpeciesCatalogItem> {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return catalog;
  }
  function match(item: SpeciesCatalogItem): boolean {
    return item.name.toLowerCase().includes(term) || String(item.id) === term;
  }
  return catalog.filter(match);
}

function sortSpeciesBySlot(a: HuntingLocationSpecies, b: HuntingLocationSpecies): number {
  const slotA = a.slot ? a.slot : 1;
  const slotB = b.slot ? b.slot : 1;
  return slotA - slotB;
}

export function SpeciesConfigForm(props: SpeciesConfigFormProps): React.ReactElement {
  const { catalog, initialSpecies, onClose, onSave } = props;
  function initSpeciesMap(): Map<number, HuntingLocationSpecies> {
    return buildInitialMap(initialSpecies);
  }
  const [selectedMap, setSelectedMap] =
    useState<Map<number, HuntingLocationSpecies>>(initSpeciesMap);
  const [searchTerm, setSearchTerm] = useState('');

  function computeFiltered(): Array<SpeciesCatalogItem> {
    return filterCatalogItems(catalog, searchTerm);
  }

  const filteredCatalog = useMemo(computeFiltered, [catalog, searchTerm]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setSearchTerm(e.target.value);
  }

  function handleToggle(item: SpeciesCatalogItem): void {
    function toggleEntry(
      prev: Map<number, HuntingLocationSpecies>,
    ): Map<number, HuntingLocationSpecies> {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        const nextSlot = next.size + 1;
        const newSpecies: HuntingLocationSpecies = {
          description: item.description,
          encounterWeight: 50,
          id: item.id,
          maximumLevel: 5,
          minimumLevel: 2,
          name: item.name,
          slot: nextSlot,
        };
        next.set(item.id, newSpecies);
      }
      return next;
    }
    setSelectedMap(toggleEntry);
  }

  function handleUpdateConfig(
    item: SpeciesCatalogItem,
    patch: Partial<HuntingLocationSpecies>,
  ): void {
    function updateEntry(
      prev: Map<number, HuntingLocationSpecies>,
    ): Map<number, HuntingLocationSpecies> {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) {
        next.set(item.id, { ...existing, ...patch });
      }
      return next;
    }
    setSelectedMap(updateEntry);
  }

  function handleSave(): void {
    const list = Array.from(selectedMap.values());
    list.sort(sortSpeciesBySlot);
    onSave(list);
    onClose();
  }

  function renderCard(item: SpeciesCatalogItem): React.ReactElement {
    const isSelected = selectedMap.has(item.id);
    const config = selectedMap.get(item.id);
    return (
      <SpeciesSlotCard
        catalogItem={item}
        config={config}
        isSelected={isSelected}
        key={item.id}
        onToggle={handleToggle}
        onUpdateConfig={handleUpdateConfig}
      />
    );
  }

  const renderedCards = filteredCatalog.map(renderCard);
  const selectedCountLabel = `${selectedMap.size} criatura(s) selecionada(s)`;

  return (
    <Stack gap="4">
      <HStack justifyContent="space-between">
        <Text color="gray.400" fontSize="sm">
          Selecione as espécies que podem spawnar neste local. Ajuste o slot, níveis e peso de
          encontro de cada criatura selecionada.
        </Text>
        <input
          onChange={handleSearchChange}
          placeholder="Buscar por nome ou #ID..."
          style={SEARCH_INPUT_STYLE}
          value={searchTerm}
        />
      </HStack>

      <Box border="1px solid #374151" borderRadius="md" maxH="420px" overflowY="auto" p="3">
        <SimpleGrid columns={3} gap="3">
          {renderedCards}
        </SimpleGrid>
      </Box>

      <HStack justifyContent="space-between" pt="2">
        <Text color="gray.400" fontSize="xs">
          {selectedCountLabel}
        </Text>
        <HStack gap="2">
          <Button onClick={onClose} size="sm" variant="outline">
            Cancelar
          </Button>
          <Button colorPalette="green" onClick={handleSave} size="sm">
            Confirmar Criaturas
          </Button>
        </HStack>
      </HStack>
    </Stack>
  );
}
