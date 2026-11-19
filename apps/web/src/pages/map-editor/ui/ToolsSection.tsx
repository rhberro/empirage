/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react';

import type { BrushType, EditorTool } from './types';

type SelectToolHandler = (tool: EditorTool) => void;
type SelectBrushHandler = (brush: BrushType) => void;

interface ToolsSectionProps {
  onSelectBrush: SelectBrushHandler;
  onSelectTool: SelectToolHandler;
  selectedBrush: BrushType;
  selectedTool: EditorTool;
}

const TOOL_BLOCKED: EditorTool = { kind: 'special', specialKind: 'blocked' };
const TOOL_ENEMY: EditorTool = { kind: 'special', specialKind: 'enemy_spawn' };
const TOOL_TRAINER: EditorTool = { kind: 'special', specialKind: 'trainer_spawn' };
const TOOL_CREATURE: EditorTool = { kind: 'special', specialKind: 'creature_spawn' };
const TOOL_ERASER: EditorTool = { kind: 'eraser' };

export function ToolsSection(props: ToolsSectionProps): React.ReactElement {
  const { onSelectBrush, onSelectTool, selectedBrush, selectedTool } = props;

  function selectPencil(): void {
    onSelectBrush('pencil');
  }

  function selectBucket(): void {
    onSelectBrush('bucket');
  }

  function selectRect(): void {
    onSelectBrush('rect');
  }

  function selectSelect(): void {
    onSelectBrush('select');
  }

  function selectBlocked(): void {
    onSelectTool(TOOL_BLOCKED);
  }

  function selectEnemySpawn(): void {
    onSelectTool(TOOL_ENEMY);
  }

  function selectTrainerSpawn(): void {
    onSelectTool(TOOL_TRAINER);
  }

  function selectCreatureSpawn(): void {
    onSelectTool(TOOL_CREATURE);
  }

  function selectEraser(): void {
    onSelectTool(TOOL_ERASER);
  }

  const isPencil = selectedBrush === 'pencil';
  const isBucket = selectedBrush === 'bucket';
  const isRect = selectedBrush === 'rect';
  const isSelect = selectedBrush === 'select';

  const pencilVariant = isPencil ? 'solid' : 'outline';
  const pencilPalette = isPencil ? 'blue' : 'gray';
  const bucketVariant = isBucket ? 'solid' : 'outline';
  const bucketPalette = isBucket ? 'blue' : 'gray';
  const rectVariant = isRect ? 'solid' : 'outline';
  const rectPalette = isRect ? 'blue' : 'gray';
  const selectVariant = isSelect ? 'solid' : 'outline';
  const selectPalette = isSelect ? 'teal' : 'gray';

  const isBlockedSelected =
    selectedTool.kind === 'special' && selectedTool.specialKind === 'blocked';
  const blockedBg = isBlockedSelected ? 'red.600' : 'red.900';

  const isEnemySelected =
    selectedTool.kind === 'special' && selectedTool.specialKind === 'enemy_spawn';
  const enemyBg = isEnemySelected ? 'purple.600' : 'purple.900';

  const isTrainerSelected =
    selectedTool.kind === 'special' && selectedTool.specialKind === 'trainer_spawn';
  const trainerBg = isTrainerSelected ? 'blue.600' : 'blue.900';

  const isCreatureSelected =
    selectedTool.kind === 'special' && selectedTool.specialKind === 'creature_spawn';
  const creatureBg = isCreatureSelected ? 'green.600' : 'green.900';

  const isEraserSelected = selectedTool.kind === 'eraser';
  const eraserBg = isEraserSelected ? 'gray.600' : 'gray.800';

  const isStampActive = selectedTool.kind === 'stamp';
  const stampLabel = isStampActive
    ? `✂️ Carimbo Ativo (${selectedTool.width}x${selectedTool.height})`
    : null;

  const stampBadge = stampLabel ? (
    <Box bg="teal.950" border="1px dashed" borderColor="teal.500" borderRadius="md" p="1.5">
      <Text color="teal.300" fontSize="2xs" fontWeight="bold">
        {stampLabel}
      </Text>
      <Text color="gray.400" fontSize="3xs">
        Clique no mapa para colar. Clique c/ direito ou escolha outro tile para cancelar.
      </Text>
    </Box>
  ) : null;

  return (
    <Stack gap="3">
      <Box border="1px solid" borderColor="gray.800" borderRadius="md" p="2">
        <Text fontSize="xs" fontWeight="bold" mb="1.5">
          Pincéis de Pintura
        </Text>
        <Stack gap="1">
          <HStack gap="1">
            <Button
              colorPalette={pencilPalette}
              flex="1"
              onClick={selectPencil}
              size="2xs"
              type="button"
              variant={pencilVariant}
            >
              ✏️ Pincel
            </Button>
            <Button
              colorPalette={bucketPalette}
              flex="1"
              onClick={selectBucket}
              size="2xs"
              type="button"
              variant={bucketVariant}
            >
              🪣 Balde
            </Button>
          </HStack>
          <HStack gap="1">
            <Button
              colorPalette={rectPalette}
              flex="1"
              onClick={selectRect}
              size="2xs"
              type="button"
              variant={rectVariant}
            >
              ⬜ Retângulo
            </Button>
            <Button
              colorPalette={selectPalette}
              flex="1"
              onClick={selectSelect}
              size="2xs"
              type="button"
              variant={selectVariant}
            >
              ✂️ Select (Área)
            </Button>
          </HStack>
        </Stack>
      </Box>

      {stampBadge}

      <Box border="1px solid" borderColor="gray.800" borderRadius="md" p="2">
        <Text fontSize="xs" fontWeight="bold" mb="2">
          Tiles Especiais (Scripts)
        </Text>
        <Stack gap="1.5">
          <Button
            bg={blockedBg}
            color="white"
            justifyContent="flex-start"
            onClick={selectBlocked}
            size="xs"
            type="button"
          >
            🔴 Blocked Tile (Bloqueio)
          </Button>
          <Button
            bg={enemyBg}
            color="white"
            justifyContent="flex-start"
            onClick={selectEnemySpawn}
            size="xs"
            type="button"
          >
            🟣 Enemy Spawn (Criaturas da Onda)
          </Button>
          <Button
            bg={trainerBg}
            color="white"
            justifyContent="flex-start"
            onClick={selectTrainerSpawn}
            size="xs"
            type="button"
          >
            🔵 Trainer Spawn (Jogador / Treinador)
          </Button>
          <Button
            bg={creatureBg}
            color="white"
            justifyContent="flex-start"
            onClick={selectCreatureSpawn}
            size="xs"
            type="button"
          >
            🟢 Creature Spawn (Criatura Ativa)
          </Button>
          <Button
            bg={eraserBg}
            color="white"
            justifyContent="flex-start"
            onClick={selectEraser}
            size="xs"
            type="button"
          >
            🧹 Borracha de Tile Especial
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
