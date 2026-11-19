/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Text } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';

import { getTileSourceCoordinates } from './tile-coords';

type ClickHandler = () => void;

interface TileItemProps {
  id: number;
  isSelected: boolean;
  onClick: ClickHandler;
  tilesetImage: HTMLImageElement | null;
}

const TILE_SIZE = 16;

const CANVAS_STYLE: React.CSSProperties = {
  display: 'block',
  imageRendering: 'pixelated',
  margin: '0 auto',
};

const HOVER_STYLE = { bg: 'gray.800' };

export function TileItem(props: TileItemProps): React.ReactElement {
  const { id, isSelected, onClick, tilesetImage } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function drawPreview(): void {
    const canvas = canvasRef.current;
    if (!canvas || !tilesetImage) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 32, 32);

    const { sx, sy } = getTileSourceCoordinates(id, tilesetImage.naturalHeight);
    context.drawImage(tilesetImage, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, 32, 32);
  }

  useEffect(drawPreview, [id, tilesetImage]);

  const borderColor = isSelected ? 'yellow.400' : 'transparent';
  const tileTitle = `Tile #${id}`;
  const label = `#${id}`;

  return (
    <Box
      _hover={HOVER_STYLE}
      alignItems="center"
      bg="gray.950"
      border="2px solid"
      borderColor={borderColor}
      borderRadius="md"
      cursor="pointer"
      display="flex"
      flexDirection="column"
      onClick={onClick}
      p="1"
      title={tileTitle}
      w="68px"
    >
      <canvas height="32" ref={canvasRef} style={CANVAS_STYLE} width="32" />
      <Text color="gray.300" fontSize="2xs" mt="1">
        {label}
      </Text>
    </Box>
  );
}
