/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

import type { HuntingLocationAnimation } from '~/entities/hunting-location';

import { TileItem } from './TileItem';
import { ToolsSection } from './ToolsSection';
import type { BrushType, EditorTool } from './types';

type AnimationList = Array<HuntingLocationAnimation>;
type OpenAnimationModalHandler = () => void;
type SelectToolHandler = (tool: EditorTool) => void;
type SelectBrushHandler = (brush: BrushType) => void;

interface TilePaletteProps {
  animations: AnimationList;
  onOpenAnimationModal: OpenAnimationModalHandler;
  onSelectBrush: SelectBrushHandler;
  onSelectTool: SelectToolHandler;
  selectedBrush: BrushType;
  selectedTool: EditorTool;
  tilesetImage: HTMLImageElement | null;
}

const DEFAULT_TOTAL_TILES = 6072;
const PAGE_SIZE = 120;

function decrementPage(p: number): number {
  return Math.max(0, p - 1);
}

function computeTotalTiles(img: HTMLImageElement | null): number {
  if (!img || !img.naturalWidth || !img.naturalHeight) {
    return DEFAULT_TOTAL_TILES;
  }
  const cols = Math.floor(img.naturalWidth / 16);
  const rows = Math.floor(img.naturalHeight / 16);
  return cols * rows;
}

export function TilePalette(props: TilePaletteProps): React.ReactElement {
  const {
    animations,
    onOpenAnimationModal,
    onSelectBrush,
    onSelectTool,
    selectedBrush,
    selectedTool,
    tilesetImage,
  } = props;

  const [page, setPage] = useState(0);
  const [searchId, setSearchId] = useState('');

  function computeTiles(): number {
    return computeTotalTiles(tilesetImage);
  }

  const totalTiles = useMemo(computeTiles, [tilesetImage]);

  const totalPages = Math.max(1, Math.ceil(totalTiles / PAGE_SIZE));

  function incrementPage(p: number): number {
    return Math.min(totalPages - 1, p + 1);
  }

  function calculateDisplayedTiles(): Array<number> {
    const trimmed = searchId.trim();
    if (trimmed) {
      const id = Math.trunc(Number(trimmed));
      if (!Number.isNaN(id) && id >= 0 && id < totalTiles) {
        return [id];
      }
      return [];
    }
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, totalTiles);
    const list: Array<number> = [];
    for (let i = start; i < end; i += 1) {
      list.push(i);
    }
    return list;
  }

  const displayedTiles = useMemo(calculateDisplayedTiles, [page, searchId, totalTiles]);

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setSearchId(event.target.value);
  }

  function handlePrevPage(): void {
    setPage(decrementPage);
  }

  function handleNextPage(): void {
    setPage(incrementPage);
  }

  const animHeader = `Animações (${animations.length})`;
  const pageLabel = `Pág ${page + 1} de ${totalPages}`;
  const isFirstPage = page <= 0;
  const isLastPage = page >= totalPages - 1;

  function renderAnimOption(anim: HuntingLocationAnimation): React.ReactElement {
    const isSelected = selectedTool.kind === 'tile' && selectedTool.animationId === anim.id;
    const bg = isSelected ? 'cyan.700' : 'gray.800';
    const label = `✨ ${anim.id} (Frame ${anim.frames[0]})`;

    function selectAnimTool(): void {
      const tool: EditorTool = {
        animationId: anim.id,
        frame: anim.frames[0] ?? 0,
        kind: 'tile',
      };
      onSelectTool(tool);
    }

    return (
      <Button
        bg={bg}
        justifyContent="flex-start"
        key={anim.id}
        onClick={selectAnimTool}
        size="2xs"
        type="button"
      >
        {label}
      </Button>
    );
  }

  const renderedAnimations = animations.map(renderAnimOption);
  const animationSection =
    animations.length > 0 ? (
      <Stack gap="1" maxH="80px" overflowY="auto">
        {renderedAnimations}
      </Stack>
    ) : (
      <Text color="gray.500" fontSize="2xs">
        Nenhuma animação cadastrada.
      </Text>
    );

  function renderTile(tileId: number): React.ReactElement {
    const isSelected =
      selectedTool.kind === 'tile' && !selectedTool.animationId && selectedTool.frame === tileId;

    function handleSelect(): void {
      const tool: EditorTool = { frame: tileId, kind: 'tile' };
      onSelectTool(tool);
    }

    return (
      <TileItem
        id={tileId}
        isSelected={isSelected}
        key={tileId}
        onClick={handleSelect}
        tilesetImage={tilesetImage}
      />
    );
  }

  const renderedTiles = displayedTiles.map(renderTile);

  const paginationBar = searchId ? null : (
    <HStack justify="space-between" mb="2">
      <Button
        colorPalette="gray"
        disabled={isFirstPage}
        onClick={handlePrevPage}
        size="2xs"
        type="button"
        variant="subtle"
      >
        ◀ Ant
      </Button>
      <Text fontSize="xs">{pageLabel}</Text>
      <Button
        colorPalette="gray"
        disabled={isLastPage}
        onClick={handleNextPage}
        size="2xs"
        type="button"
        variant="subtle"
      >
        Próx ▶
      </Button>
    </HStack>
  );

  return (
    <Stack bg="gray.900" borderRight="1px solid" borderColor="gray.800" h="full" p="3" w="360px">
      <Text fontSize="sm" fontWeight="bold">
        Ferramentas & Tiles
      </Text>

      <ToolsSection
        onSelectBrush={onSelectBrush}
        onSelectTool={onSelectTool}
        selectedBrush={selectedBrush}
        selectedTool={selectedTool}
      />

      <Box border="1px solid" borderColor="gray.800" borderRadius="md" p="2">
        <HStack justify="space-between" mb="2">
          <Text fontSize="xs" fontWeight="bold">
            {animHeader}
          </Text>
          <Button onClick={onOpenAnimationModal} size="2xs" type="button" variant="outline">
            Gerenciar
          </Button>
        </HStack>
        {animationSection}
      </Box>

      <Box>
        <HStack mb="2">
          <Input
            onChange={handleSearchChange}
            placeholder="Buscar ID do Tile (ex: 45)"
            size="xs"
            value={searchId}
          />
        </HStack>
        {paginationBar}
      </Box>

      <Box flex="1" overflowY="auto" pr="1">
        <HStack flexWrap="wrap" gap="1">
          {renderedTiles}
        </HStack>
      </Box>
    </Stack>
  );
}
