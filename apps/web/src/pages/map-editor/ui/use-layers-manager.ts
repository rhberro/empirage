/* eslint-disable oxsome/no-inline-structural-types */
import { useState } from 'react';

import {
  createAddedLayer,
  createInitialLayers,
  INITIAL_DEFAULT_LAYERS,
  removeLayerFromList,
  toggleLayerPlacement,
  toggleLayerVisibility,
  updateLayerNameInList,
} from './layers-manager-helpers';

export { createInitialLayers, INITIAL_DEFAULT_LAYERS };
import type { HuntingLocationMapLayer } from './types';

type LayersSetter = React.Dispatch<React.SetStateAction<Array<HuntingLocationMapLayer>>>;

export function addLayerAction(
  pushSnapshot: () => void,
  layers: Array<HuntingLocationMapLayer>,
  setLayers: LayersSetter,
  setActiveLayerId: (id: string) => void,
): void {
  pushSnapshot();
  const newLayer = createAddedLayer(layers.length);
  function appendLayer(prev: Array<HuntingLocationMapLayer>): Array<HuntingLocationMapLayer> {
    return [...prev, newLayer];
  }
  setLayers(appendLayer);
  setActiveLayerId(newLayer.id);
}

export function deleteLayerAction(
  pushSnapshot: () => void,
  layers: Array<HuntingLocationMapLayer>,
  setLayers: LayersSetter,
  activeLayerId: string,
  setActiveLayerId: (id: string) => void,
  id: string,
): void {
  if (layers.length <= 1) {
    return;
  }
  pushSnapshot();
  const nextLayers = removeLayerFromList(layers, id);
  setLayers(nextLayers);
  if (activeLayerId === id) {
    setActiveLayerId(nextLayers[0].id);
  }
}

export function togglePlacementAction(
  pushSnapshot: () => void,
  setLayers: LayersSetter,
  id: string,
): void {
  pushSnapshot();
  function runToggle(prev: Array<HuntingLocationMapLayer>): Array<HuntingLocationMapLayer> {
    return toggleLayerPlacement(prev, id);
  }
  setLayers(runToggle);
}

export function toggleVisibilityAction(setLayers: LayersSetter, id: string): void {
  function runVisibility(prev: Array<HuntingLocationMapLayer>): Array<HuntingLocationMapLayer> {
    return toggleLayerVisibility(prev, id);
  }
  setLayers(runVisibility);
}

export function updateLayerNameAction(setLayers: LayersSetter, id: string, name: string): void {
  function runUpdate(prev: Array<HuntingLocationMapLayer>): Array<HuntingLocationMapLayer> {
    return updateLayerNameInList(prev, id, name);
  }
  setLayers(runUpdate);
}

export interface UseLayersManagerResult {
  activeLayerId: string;
  handleAddLayer: () => void;
  handleDeleteLayer: (id: string) => void;
  handleSelectLayer: (id: string) => void;
  handleTogglePlacement: (id: string) => void;
  handleToggleVisibility: (id: string) => void;
  handleUpdateLayerName: (id: string, name: string) => void;
  layers: Array<HuntingLocationMapLayer>;
  setActiveLayerId: (id: string) => void;
  setLayers: LayersSetter;
}

export function useLayersManager(
  pushSnapshot: () => void,
  layers: Array<HuntingLocationMapLayer>,
  setLayers: LayersSetter,
): UseLayersManagerResult {
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-0');

  function handleAddLayer(): void {
    addLayerAction(pushSnapshot, layers, setLayers, setActiveLayerId);
  }

  function handleDeleteLayer(id: string): void {
    deleteLayerAction(pushSnapshot, layers, setLayers, activeLayerId, setActiveLayerId, id);
  }

  function handleSelectLayer(id: string): void {
    setActiveLayerId(id);
  }

  function handleTogglePlacement(id: string): void {
    togglePlacementAction(pushSnapshot, setLayers, id);
  }

  function handleToggleVisibility(id: string): void {
    toggleVisibilityAction(setLayers, id);
  }

  function handleUpdateLayerName(id: string, name: string): void {
    updateLayerNameAction(setLayers, id, name);
  }

  return {
    activeLayerId,
    handleAddLayer,
    handleDeleteLayer,
    handleSelectLayer,
    handleTogglePlacement,
    handleToggleVisibility,
    handleUpdateLayerName,
    layers,
    setActiveLayerId,
    setLayers,
  };
}
