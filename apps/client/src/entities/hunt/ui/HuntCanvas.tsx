import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import { HuntScene } from './huntScene';

/**
 * The canvas of the hunt, drawn by Pixi and read from the hunt store.
 *
 * Like the city canvas, the component owns only the canvas: it mounts the
 * scene, which reads the store inside the ticker, never through React.
 */
export function HuntCanvas(): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(mount, []);

  function mount(): (() => void) | undefined {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    const scene = new HuntScene(host);
    scene.start();
    return function cleanup(): void {
      scene.destroy();
    };
  }

  return <Box bg="bg.sunken" flex="1" overflow="hidden" position="relative" ref={hostRef} />;
}
