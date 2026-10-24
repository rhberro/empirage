import { useEffect, useState } from 'react';

import { computeWorldScale } from '~/entities/world/model/scale';

/**
 * The zoom of the reference screen, where the HUD chrome is drawn one to one.
 *
 * The interface is designed for a 1280×720 window, which the canvas covers at
 * zoom three. Below that zoom the chrome shrinks with the canvas; above it the
 * desktop size is kept.
 */
const REFERENCE_ZOOM = computeWorldScale(1280, 720);

/**
 * The scale of the HUD chrome, from the canvas zoom.
 *
 * The canvas is a fixed logical window that CSS zooms by an integer to cover
 * its host. The chrome is drawn for the reference zoom, so on smaller screens
 * it shrinks with the canvas instead of staying at the desktop size.
 */
export function useCanvasScale(): number {
  const [scale, setScale] = useState<number>(readScale);
  useEffect(buildResizeSync(setScale), []);
  return scale;
}

export function useCanvasTransform(): string {
  const scale = useCanvasScale();
  return 'scale(' + scale + ')';
}

function readScale(): number {
  const zoom = computeWorldScale(window.innerWidth, window.innerHeight);
  return Math.min(1, zoom / REFERENCE_ZOOM);
}

function buildResizeSync(setScale: (scale: number) => void): () => () => void {
  function handleResize(): void {
    setScale(readScale());
  }
  return function startSync(): () => void {
    window.addEventListener('resize', handleResize);
    return function stopSync(): void {
      window.removeEventListener('resize', handleResize);
    };
  };
}
