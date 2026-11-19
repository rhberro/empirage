/* eslint-disable oxsome/no-inline-structural-types */
import { HStack, Input, Text } from '@chakra-ui/react';

export interface GridDimensionInputsProps {
  mapHeight: number;
  mapWidth: number;
  onHeightChange: (val: number) => void;
  onWidthChange: (val: number) => void;
}

export function GridDimensionInputs(props: GridDimensionInputsProps): React.ReactElement {
  const { mapHeight, mapWidth, onHeightChange, onWidthChange } = props;

  function handleWidthChange(e: React.ChangeEvent<HTMLInputElement>): void {
    onWidthChange(Number(e.target.value) || 12);
  }

  function handleHeightChange(e: React.ChangeEvent<HTMLInputElement>): void {
    onHeightChange(Number(e.target.value) || 8);
  }

  return (
    <HStack gap="2">
      <Text color="gray.400" fontSize="xs">
        Grid:
      </Text>
      <Input
        max="64"
        min="4"
        onChange={handleWidthChange}
        size="2xs"
        type="number"
        value={mapWidth}
        w="50px"
      />
      <Text color="gray.400" fontSize="xs">
        x
      </Text>
      <Input
        max="64"
        min="4"
        onChange={handleHeightChange}
        size="2xs"
        type="number"
        value={mapHeight}
        w="50px"
      />
    </HStack>
  );
}
