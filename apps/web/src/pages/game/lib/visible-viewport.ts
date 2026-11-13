export type VisibleViewport = { height: number; width: number; x: number; y: number };

export function visibleViewport(
  width: number,
  height: number,
  parentWidth: number,
  parentHeight: number,
): VisibleViewport {
  const scale = Math.max(parentWidth / width, parentHeight / height) || 1;
  const visibleWidth = parentWidth / scale;
  const visibleHeight = parentHeight / scale;
  return {
    height: visibleHeight,
    width: visibleWidth,
    x: (width - visibleWidth) / 2,
    y: (height - visibleHeight) / 2,
  };
}
