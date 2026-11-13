import { visibleViewport } from './visible-viewport';

type Camera = {
  setBounds: (x: number, y: number, width: number, height: number) => unknown;
  setViewport: (x: number, y: number, width: number, height: number) => unknown;
};
type Scale = { height: number; parentSize: { height: number; width: number }; width: number };

export function configureCameraViewport(camera: Camera, scale: Scale): void {
  const viewport = visibleViewport(
    scale.width,
    scale.height,
    scale.parentSize.width,
    scale.parentSize.height,
  );
  camera.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
}
