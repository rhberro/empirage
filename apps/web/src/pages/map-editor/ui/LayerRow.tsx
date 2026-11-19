/* eslint-disable oxsome/no-inline-structural-types */
import { Badge, Button, HStack, IconButton, Input } from '@chakra-ui/react';
import { LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

import type { HuntingLocationMapLayer } from '~/entities/hunting-location';

type IdHandler = (id: string) => void;
type NameHandler = (id: string, name: string) => void;

interface LayerRowProps {
  activeLayerId: string;
  layer: HuntingLocationMapLayer;
  onDeleteLayer: IdHandler;
  onSelectLayer: IdHandler;
  onTogglePlacement: IdHandler;
  onToggleVisibility: IdHandler;
  onUpdateLayerName: NameHandler;
}

function stopPropagation(e: React.MouseEvent): void {
  e.stopPropagation();
}

export function LayerRow(props: LayerRowProps): React.ReactElement {
  const {
    activeLayerId,
    layer,
    onDeleteLayer,
    onSelectLayer,
    onTogglePlacement,
    onToggleVisibility,
    onUpdateLayerName,
  } = props;

  const isActive = layer.id === activeLayerId;
  const isBaseLayer = layer.order === 0;
  const isVisible = layer.visible !== false;
  const isAbove = layer.placement === 'above_characters';
  const tileCount = layer.tiles.length;
  const titleText = isBaseLayer
    ? 'A camada base 0 é sempre abaixo dos personagens'
    : 'Alternar se renderiza acima ou abaixo dos personagens';

  function handleRowClick(): void {
    onSelectLayer(layer.id);
  }

  function handleVisibilityClick(e: React.MouseEvent): void {
    e.stopPropagation();
    onToggleVisibility(layer.id);
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>): void {
    onUpdateLayerName(layer.id, e.target.value);
  }

  function handlePlacementClick(e: React.MouseEvent): void {
    e.stopPropagation();
    if (!isBaseLayer) {
      onTogglePlacement(layer.id);
    }
  }

  function handleDeleteClick(e: React.MouseEvent): void {
    e.stopPropagation();
    onDeleteLayer(layer.id);
  }

  const bg = isActive ? 'gray.800' : 'gray.950';
  const border = isActive ? 'blue.500' : 'gray.800';
  const eyeColor = isVisible ? 'gray.300' : 'gray.600';
  const placementPalette = isAbove ? 'purple' : 'gray';
  const placementText = isAbove ? 'Acima' : 'Abaixo';
  const eyeLabel = isVisible ? 'Ocultar camada' : 'Exibir camada';
  const EyeIcon = isVisible ? LuEye : LuEyeOff;

  const deleteButton = isBaseLayer ? null : (
    <IconButton
      aria-label="Excluir camada"
      color="red.400"
      onClick={handleDeleteClick}
      size="xs"
      variant="ghost"
    >
      <LuTrash2 />
    </IconButton>
  );

  return (
    <HStack
      bg={bg}
      border="1px solid"
      borderColor={border}
      borderRadius="md"
      cursor="pointer"
      gap={2}
      onClick={handleRowClick}
      p={1.5}
    >
      <IconButton
        aria-label={eyeLabel}
        color={eyeColor}
        onClick={handleVisibilityClick}
        size="xs"
        variant="ghost"
      >
        <EyeIcon />
      </IconButton>

      <Input
        flex={1}
        fontSize="xs"
        h="24px"
        onChange={handleNameChange}
        onClick={stopPropagation}
        px={1.5}
        value={layer.name}
        variant="subtle"
      />

      <Button
        colorPalette={placementPalette}
        disabled={isBaseLayer}
        fontSize="2xs"
        h="20px"
        onClick={handlePlacementClick}
        px={1.5}
        size="xs"
        title={titleText}
        variant="subtle"
      >
        {placementText}
      </Button>

      <Badge fontSize="2xs" variant="outline">
        {tileCount}
      </Badge>

      {deleteButton}
    </HStack>
  );
}
