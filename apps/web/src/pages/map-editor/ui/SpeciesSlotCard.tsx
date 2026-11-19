/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react';

import type { HuntingLocationSpecies, SpeciesCatalogItem } from './types';

export interface SpeciesSlotCardProps {
  catalogItem: SpeciesCatalogItem;
  config?: HuntingLocationSpecies;
  isSelected: boolean;
  onToggle: (item: SpeciesCatalogItem) => void;
  onUpdateConfig: (item: SpeciesCatalogItem, patch: Partial<HuntingLocationSpecies>) => void;
}

const NUMBER_INPUT_STYLE: React.CSSProperties = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  borderRadius: '4px',
  color: 'white',
  fontSize: '11px',
  padding: '2px 4px',
  textAlign: 'center',
  width: '100%',
};

const PIXELATED_STYLE: React.CSSProperties = {
  imageRendering: 'pixelated',
};

export function SpeciesSlotCard(props: SpeciesSlotCardProps): React.ReactElement {
  const { catalogItem, config, isSelected, onToggle, onUpdateConfig } = props;

  function handleCardClick(): void {
    onToggle(catalogItem);
  }

  function handleSlotChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const patch = { slot: Math.max(1, Number(e.target.value)) };
    onUpdateConfig(catalogItem, patch);
  }

  function handleMinLevelChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const patch = { minimumLevel: Math.max(1, Number(e.target.value)) };
    onUpdateConfig(catalogItem, patch);
  }

  function handleMaxLevelChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const patch = { maximumLevel: Math.max(1, Number(e.target.value)) };
    onUpdateConfig(catalogItem, patch);
  }

  function handleWeightChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const patch = { encounterWeight: Math.max(1, Number(e.target.value)) };
    onUpdateConfig(catalogItem, patch);
  }

  const iconSrc = `/assets/creatures/icons/${catalogItem.id}.png`;
  const bg = isSelected ? '#1e293b' : '#0f172a';
  const borderColor = isSelected ? '#3b82f6' : '#334155';
  const opacity = isSelected ? 1 : 0.45;
  const statusPalette = isSelected ? 'blue' : 'gray';
  const statusLabel = isSelected ? 'Ativo' : 'Inativo';
  const itemTitle = `#${catalogItem.id} ${catalogItem.name}`;
  const slotVal = config && config.slot ? config.slot : 1;
  const minLevelVal = config ? config.minimumLevel : 1;
  const maxLevelVal = config ? config.maximumLevel : 1;
  const weightVal = config ? config.encounterWeight : 1;

  const configInputs =
    isSelected && config ? (
      <Box borderTop="1px solid #334155" mt="2" pt="2">
        <HStack gap="2">
          <Stack flex="1" gap="0">
            <Text color="gray.400" fontSize="2xs">
              Slot
            </Text>
            <input
              min={1}
              onChange={handleSlotChange}
              style={NUMBER_INPUT_STYLE}
              type="number"
              value={slotVal}
            />
          </Stack>
          <Stack flex="1" gap="0">
            <Text color="gray.400" fontSize="2xs">
              Nv Mín
            </Text>
            <input
              min={1}
              onChange={handleMinLevelChange}
              style={NUMBER_INPUT_STYLE}
              type="number"
              value={minLevelVal}
            />
          </Stack>
          <Stack flex="1" gap="0">
            <Text color="gray.400" fontSize="2xs">
              Nv Máx
            </Text>
            <input
              min={1}
              onChange={handleMaxLevelChange}
              style={NUMBER_INPUT_STYLE}
              type="number"
              value={maxLevelVal}
            />
          </Stack>
          <Stack flex="1" gap="0">
            <Text color="gray.400" fontSize="2xs">
              Peso
            </Text>
            <input
              min={1}
              onChange={handleWeightChange}
              style={NUMBER_INPUT_STYLE}
              type="number"
              value={weightVal}
            />
          </Stack>
        </HStack>
      </Box>
    ) : null;

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      opacity={opacity}
      p="2.5"
      transition="all 0.15s ease"
    >
      <HStack
        alignItems="center"
        cursor="pointer"
        justifyContent="space-between"
        onClick={handleCardClick}
      >
        <HStack gap="2">
          <img
            alt={catalogItem.name}
            height="32"
            src={iconSrc}
            style={PIXELATED_STYLE}
            width="32"
          />
          <Stack gap="0">
            <Text fontSize="xs" fontWeight="bold">
              {itemTitle}
            </Text>
          </Stack>
        </HStack>
        <Button colorPalette={statusPalette} size="2xs" variant="surface">
          {statusLabel}
        </Button>
      </HStack>
      {configInputs}
    </Box>
  );
}
