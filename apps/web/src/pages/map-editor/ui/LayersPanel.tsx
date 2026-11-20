/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react';

import type { HuntingLocationMapLayer } from '~/entities/hunting-location';
import { Icon } from '~/shared/ui/Icon';

import { LayerRow } from './LayerRow';

type IdHandler = (id: string) => void;
type NameHandler = (id: string, name: string) => void;
type VoidHandler = () => void;

interface LayersPanelProps {
  activeLayerId: string;
  layers: Array<HuntingLocationMapLayer>;
  onAddLayer: VoidHandler;
  onDeleteLayer: IdHandler;
  onSelectLayer: IdHandler;
  onTogglePlacement: IdHandler;
  onToggleVisibility: IdHandler;
  onUpdateLayerName: NameHandler;
}

export function LayersPanel(props: LayersPanelProps): React.ReactElement {
  const {
    activeLayerId,
    layers,
    onAddLayer,
    onDeleteLayer,
    onSelectLayer,
    onTogglePlacement,
    onToggleVisibility,
    onUpdateLayerName,
  } = props;

  const layerCount = layers.length;
  const headerText = `Camadas (${layerCount})`;

  function renderLayerRow(layer: HuntingLocationMapLayer): React.ReactElement {
    return (
      <LayerRow
        activeLayerId={activeLayerId}
        key={layer.id}
        layer={layer}
        onDeleteLayer={onDeleteLayer}
        onSelectLayer={onSelectLayer}
        onTogglePlacement={onTogglePlacement}
        onToggleVisibility={onToggleVisibility}
        onUpdateLayerName={onUpdateLayerName}
      />
    );
  }

  const renderedRows = layers.map(renderLayerRow);

  return (
    <Box bg="gray.900" borderTop="1px solid" borderColor="gray.800" p={3}>
      <HStack justify="space-between" mb={2}>
        <Text color="gray.400" fontSize="xs" fontWeight="bold" textTransform="uppercase">
          {headerText}
        </Text>
        <Button colorPalette="blue" onClick={onAddLayer} size="xs" variant="surface">
          <Icon name="add" /> Adicionar Camada
        </Button>
      </HStack>

      <Stack gap={1} maxH="140px" overflowY="auto">
        {renderedRows}
      </Stack>
    </Box>
  );
}
