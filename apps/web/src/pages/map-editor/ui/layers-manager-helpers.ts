/* eslint-disable oxsome/no-inline-structural-types */
import type { HuntingLocationMapLayer, HuntingLocationMapTile } from './types';

export const INITIAL_DEFAULT_LAYERS: Array<HuntingLocationMapLayer> = [
  {
    id: 'layer-0',
    name: 'Ground (Base)',
    order: 0,
    placement: 'below_characters',
    tiles: [],
    visible: true,
  },
];

export function cloneLayerWithTiles(l: HuntingLocationMapLayer): HuntingLocationMapLayer {
  return {
    ...l,
    tiles: Array.from(l.tiles),
  };
}

export function createInitialLayers(
  layers?: Array<HuntingLocationMapLayer>,
  fallbackTiles: Array<HuntingLocationMapTile> = [],
): Array<HuntingLocationMapLayer> {
  if (layers && layers.length > 0) {
    return layers.map(cloneLayerWithTiles);
  }
  return [
    {
      id: 'layer-0',
      name: 'Ground (Base)',
      order: 0,
      placement: 'below_characters',
      tiles: fallbackTiles,
      visible: true,
    },
  ];
}

function reorderLayer(l: HuntingLocationMapLayer, idx: number): HuntingLocationMapLayer {
  return { ...l, order: idx };
}

export function createAddedLayer(order: number): HuntingLocationMapLayer {
  return {
    id: `layer-${Date.now()}`,
    name: `Camada ${order}`,
    order,
    placement: 'below_characters',
    tiles: [],
    visible: true,
  };
}

export function removeLayerFromList(
  layers: Array<HuntingLocationMapLayer>,
  id: string,
): Array<HuntingLocationMapLayer> {
  function notId(l: HuntingLocationMapLayer): boolean {
    return l.id !== id;
  }
  return layers.filter(notId).map(reorderLayer);
}

export function toggleLayerPlacement(
  layers: Array<HuntingLocationMapLayer>,
  id: string,
): Array<HuntingLocationMapLayer> {
  function mapPlacement(layer: HuntingLocationMapLayer): HuntingLocationMapLayer {
    if (layer.id !== id || layer.order === 0) {
      return layer;
    }
    const nextPlacement =
      layer.placement === 'above_characters' ? 'below_characters' : 'above_characters';
    return { ...layer, placement: nextPlacement };
  }
  return layers.map(mapPlacement);
}

export function toggleLayerVisibility(
  layers: Array<HuntingLocationMapLayer>,
  id: string,
): Array<HuntingLocationMapLayer> {
  function mapVisibility(layer: HuntingLocationMapLayer): HuntingLocationMapLayer {
    if (layer.id !== id) {
      return layer;
    }
    return { ...layer, visible: layer.visible === false };
  }
  return layers.map(mapVisibility);
}

export function updateLayerNameInList(
  layers: Array<HuntingLocationMapLayer>,
  id: string,
  name: string,
): Array<HuntingLocationMapLayer> {
  function mapName(layer: HuntingLocationMapLayer): HuntingLocationMapLayer {
    if (layer.id === id) {
      return { ...layer, name };
    }
    return layer;
  }
  return layers.map(mapName);
}
