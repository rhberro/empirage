/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';

import type { HuntingLocationAnimation } from '~/entities/hunting-location';

type AnimationList = Array<HuntingLocationAnimation>;
type CloseHandler = () => void;
type SaveHandler = (animations: AnimationList) => void;
type AnimationMode = 'loop' | 'pingpong';

export interface AnimationManagerFormProps {
  animations: AnimationList;
  onClose: CloseHandler;
  onSave: SaveHandler;
}

function parseSingleFrame(frameText: string): number {
  return Math.trunc(Number(frameText.trim()));
}

function isPositiveNumber(num: number): boolean {
  return !Number.isNaN(num) && num >= 0;
}

export function AnimationManagerForm(props: AnimationManagerFormProps): React.ReactElement {
  const { animations, onClose, onSave } = props;
  const [list, setList] = useState<AnimationList>(animations);
  const [animId, setAnimId] = useState('');
  const [framesStr, setFramesStr] = useState('');
  const [frameRateMs, setFrameRateMs] = useState(150);
  const [mode, setMode] = useState<AnimationMode>('loop');
  const [iterations, setIterations] = useState(0);

  function handleAddAnimation(): void {
    const trimmedId = animId.trim();
    if (!trimmedId) {
      return;
    }

    const rawFrames = framesStr.split(',').map(parseSingleFrame);
    const validFrames = rawFrames.filter(isPositiveNumber);
    if (validFrames.length === 0) {
      return;
    }

    const newAnim: HuntingLocationAnimation = {
      frameRateMs,
      frames: validFrames,
      id: trimmedId,
      iterations,
      mode,
    };

    function updateList(previousList: AnimationList): AnimationList {
      function filterOut(item: HuntingLocationAnimation): boolean {
        return item.id !== newAnim.id;
      }
      const filtered = previousList.filter(filterOut);
      return [...filtered, newAnim];
    }

    setList(updateList);
    setAnimId('');
    setFramesStr('');
  }

  function handleDelete(idToDelete: string): void {
    function filterOut(item: HuntingLocationAnimation): boolean {
      return item.id !== idToDelete;
    }
    function updateList(previousList: AnimationList): AnimationList {
      return previousList.filter(filterOut);
    }
    setList(updateList);
  }

  function handleApply(): void {
    onSave(list);
    onClose();
  }

  function handleIdChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setAnimId(event.target.value);
  }

  function handleFramesChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setFramesStr(event.target.value);
  }

  function handleRateChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const parsed = Math.trunc(Number(event.target.value));
    setFrameRateMs(parsed || 150);
  }

  function handleIterationsChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const parsed = Math.trunc(Number(event.target.value));
    setIterations(parsed || 0);
  }

  function handleSetLoop(): void {
    setMode('loop');
  }

  function handleSetPingpong(): void {
    setMode('pingpong');
  }

  const loopVariant = mode === 'loop' ? 'solid' : 'outline';
  const loopPalette = mode === 'loop' ? 'blue' : 'gray';
  const pingpongVariant = mode === 'pingpong' ? 'solid' : 'outline';
  const pingpongPalette = mode === 'pingpong' ? 'blue' : 'gray';
  const hasNoAnimations = list.length === 0;
  const listCountTitle = `Animações Existentes (${list.length})`;

  function renderExistingAnimation(anim: HuntingLocationAnimation): React.ReactElement {
    const animKey = anim.id;
    const animFramesLabel = `Frames: [${anim.frames.join(', ')}] | ${anim.frameRateMs}ms | ${anim.mode} | ${
      anim.iterations === 0 ? 'Infinito' : `${anim.iterations}x`
    }`;

    function deleteCurrentAnim(): void {
      handleDelete(anim.id);
    }

    return (
      <HStack bg="gray.800" borderRadius="md" justifyContent="space-between" key={animKey} p="2">
        <Box>
          <Text fontSize="sm" fontWeight="bold">
            {anim.id}
          </Text>
          <Text color="gray.400" fontSize="xs">
            {animFramesLabel}
          </Text>
        </Box>
        <Button
          colorPalette="red"
          onClick={deleteCurrentAnim}
          size="xs"
          type="button"
          variant="ghost"
        >
          Excluir
        </Button>
      </HStack>
    );
  }

  const renderedAnimations = list.map(renderExistingAnimation);
  const animationListElement = hasNoAnimations ? (
    <Text color="gray.400" fontSize="xs">
      Nenhuma animação cadastrada ainda.
    </Text>
  ) : (
    <Stack gap="2" maxH="200px" overflowY="auto">
      {renderedAnimations}
    </Stack>
  );

  return (
    <Stack gap="4">
      <Box border="1px solid" borderColor="gray.700" borderRadius="md" p="3">
        <Text fontSize="sm" fontWeight="bold" mb="2">
          Criar / Atualizar Animação
        </Text>
        <Stack gap="3">
          <HStack>
            <Box flex="1">
              <Text fontSize="xs" mb="1">
                ID da Animação
              </Text>
              <Input
                onChange={handleIdChange}
                placeholder="ex: water_wave_1"
                size="sm"
                value={animId}
              />
            </Box>
            <Box flex="1">
              <Text fontSize="xs" mb="1">
                Frames (IDs separados por vírgula)
              </Text>
              <Input
                onChange={handleFramesChange}
                placeholder="ex: 120, 121, 122"
                size="sm"
                value={framesStr}
              />
            </Box>
          </HStack>
          <HStack>
            <Box flex="1">
              <Text fontSize="xs" mb="1">
                Duração do Frame (ms)
              </Text>
              <Input
                min="16"
                onChange={handleRateChange}
                size="sm"
                type="number"
                value={frameRateMs}
              />
            </Box>
            <Box flex="1">
              <Text fontSize="xs" mb="1">
                Modo
              </Text>
              <HStack gap="2">
                <Button
                  colorPalette={loopPalette}
                  onClick={handleSetLoop}
                  size="xs"
                  type="button"
                  variant={loopVariant}
                >
                  Loop
                </Button>
                <Button
                  colorPalette={pingpongPalette}
                  onClick={handleSetPingpong}
                  size="xs"
                  type="button"
                  variant={pingpongVariant}
                >
                  Ping-Pong
                </Button>
              </HStack>
            </Box>
            <Box flex="1">
              <Text fontSize="xs" mb="1">
                Repetições (0 = infinito)
              </Text>
              <Input
                min="0"
                onChange={handleIterationsChange}
                size="sm"
                type="number"
                value={iterations}
              />
            </Box>
          </HStack>
          <Button colorPalette="teal" onClick={handleAddAnimation} size="sm" type="button">
            Adicionar Animação
          </Button>
        </Stack>
      </Box>

      <Box>
        <Text fontSize="sm" fontWeight="bold" mb="2">
          {listCountTitle}
        </Text>
        {animationListElement}
      </Box>

      <HStack justify="flex-end" pt="2" w="full">
        <Button onClick={onClose} size="sm" type="button" variant="outline">
          Cancelar
        </Button>
        <Button colorPalette="blue" onClick={handleApply} size="sm" type="button">
          Salvar Animações
        </Button>
      </HStack>
    </Stack>
  );
}
