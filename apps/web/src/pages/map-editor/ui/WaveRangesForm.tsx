/* eslint-disable oxsome/no-inline-structural-types */
import { Box, Button, HStack, Stack, Table, Text } from '@chakra-ui/react';
import { useState } from 'react';

import type { HuntingLocationWaveRange } from './types';

type WaveRangeList = Array<HuntingLocationWaveRange>;
type CloseHandler = () => void;
type SaveHandler = (ranges: WaveRangeList) => void;

export interface WaveRangesFormProps {
  initialWaveRanges: WaveRangeList;
  onClose: CloseHandler;
  onSave: SaveHandler;
}

const SELECT_INPUT_STYLE: React.CSSProperties = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '4px',
  color: 'white',
  fontSize: '12px',
  padding: '4px 8px',
  width: '100px',
};

function sortWaveRanges(a: HuntingLocationWaveRange, b: HuntingLocationWaveRange): number {
  if (a.minimumSize !== b.minimumSize) {
    return a.minimumSize - b.minimumSize;
  }
  return a.maximumSize - b.maximumSize;
}

export function WaveRangesForm(props: WaveRangesFormProps): React.ReactElement {
  const { initialWaveRanges, onClose, onSave } = props;
  const [ranges, setRanges] = useState<WaveRangeList>(initialWaveRanges);
  const [minSizeInput, setMinSizeInput] = useState(1);
  const [maxSizeInput, setMaxSizeInput] = useState(2);

  function handleMinChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setMinSizeInput(Math.max(1, Number(e.target.value)));
  }

  function handleMaxChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setMaxSizeInput(Math.max(1, Number(e.target.value)));
  }

  function handleAdd(): void {
    if (minSizeInput <= 0 || maxSizeInput < minSizeInput) {
      return;
    }
    function checkExists(r: HuntingLocationWaveRange): boolean {
      return r.minimumSize === minSizeInput && r.maximumSize === maxSizeInput;
    }
    const alreadyExists = ranges.some(checkExists);
    if (alreadyExists) {
      return;
    }
    const newRange: HuntingLocationWaveRange = {
      maximumSize: maxSizeInput,
      minimumSize: minSizeInput,
    };
    const next = [...ranges, newRange];
    next.sort(sortWaveRanges);
    setRanges(next);
  }

  function handleSave(): void {
    onSave(ranges);
    onClose();
  }

  function handleRemoveByIndex(idx: number): void {
    function isNotIndex(_: HuntingLocationWaveRange, i: number): boolean {
      return i !== idx;
    }
    function removeRange(prev: WaveRangeList): WaveRangeList {
      return prev.filter(isNotIndex);
    }
    setRanges(removeRange);
  }

  function renderRow(range: HuntingLocationWaveRange, idx: number): React.ReactElement {
    function handleRemove(): void {
      handleRemoveByIndex(idx);
    }

    const key = `${range.minimumSize}-${range.maximumSize}-${idx}`;
    return (
      <Table.Row key={key}>
        <Table.Cell>{range.minimumSize}</Table.Cell>
        <Table.Cell>{range.maximumSize}</Table.Cell>
        <Table.Cell textAlign="right">
          <Button colorPalette="red" onClick={handleRemove} size="xs" variant="ghost">
            Remover
          </Button>
        </Table.Cell>
      </Table.Row>
    );
  }

  const renderedRows = ranges.map(renderRow);

  return (
    <Stack gap="4">
      <Text color="gray.400" fontSize="sm">
        Configure as faixas de criaturas por onda suportadas neste local de caça. O jogador
        escolherá uma dessas faixas ao iniciar a caçada.
      </Text>

      <HStack alignItems="flex-end" gap="3">
        <Stack gap="1">
          <Text fontSize="xs">Mínimo de criaturas</Text>
          <input
            min={1}
            onChange={handleMinChange}
            style={SELECT_INPUT_STYLE}
            type="number"
            value={minSizeInput}
          />
        </Stack>
        <Stack gap="1">
          <Text fontSize="xs">Máximo de criaturas</Text>
          <input
            min={minSizeInput}
            onChange={handleMaxChange}
            style={SELECT_INPUT_STYLE}
            type="number"
            value={maxSizeInput}
          />
        </Stack>
        <Button colorPalette="blue" onClick={handleAdd} size="sm">
          Adicionar Faixa
        </Button>
      </HStack>

      <Box border="1px solid #374151" borderRadius="md" maxH="240px" overflowY="auto">
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Mínimo</Table.ColumnHeader>
              <Table.ColumnHeader>Máximo</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Ação</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>{renderedRows}</Table.Body>
        </Table.Root>
      </Box>

      <HStack justifyContent="flex-end" pt="3">
        <Button onClick={onClose} size="sm" variant="outline">
          Cancelar
        </Button>
        <Button colorPalette="green" onClick={handleSave} size="sm">
          Confirmar Faixas
        </Button>
      </HStack>
    </Stack>
  );
}
