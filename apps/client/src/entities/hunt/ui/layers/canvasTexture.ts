import { CanvasSource, Texture } from 'pixi.js';

/**
 * A texture drawn once on a canvas.
 *
 * Small shapes such as the health bar border, the shadow and the target ring
 * are cheaper as a `Sprite` from a shared texture than as a `Graphics` rebuilt
 * every frame: the sprites of the same texture batch into one draw call.
 */
export function createCanvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('the canvas 2d context is not available');
  }
  draw(context);
  const source = new CanvasSource({ resource: canvas });
  source.scaleMode = 'nearest';
  return new Texture({ source });
}
