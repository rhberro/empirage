import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { useSelectionRing } from '~/shared/theme';
import { Pressable } from '~/shared/ui/interactive';
import { Text } from '~/shared/ui/text';

const CARD_SIZE = '4rem';

type StarterCardProps = {
  isSelected: boolean;
  onSelect: (id: string) => void;
  starterId: string;
  starterName: string;
};

export function StarterCard(props: StarterCardProps): ReactElement {
  const { isSelected, onSelect, starterId, starterName } = props;
  const selectionRing = useSelectionRing();
  const ring = isSelected ? selectionRing : undefined;
  const borderColor = isSelected ? 'state.selected' : 'border';

  function handleSelect(): void {
    onSelect(starterId);
  }

  return (
    <Pressable onPress={handleSelect}>
      <Box textAlign="center">
        <Box
          _before={ring}
          bg="bg.raised"
          borderColor={borderColor}
          borderRadius="sm"
          borderWidth="1px"
          height={CARD_SIZE}
          overflow="hidden"
          position="relative"
          transitionProperty="border-color"
          transitionDuration="150ms"
          transitionTimingFunction="ease-out"
          width="full"
        >
          <Box
            alignItems="center"
            bg="ember.400"
            display="flex"
            height="full"
            justifyContent="center"
            width="full"
          />
        </Box>
        <Text color="fg" marginBlockStart="1" overflow="hidden" variant="meta" whiteSpace="nowrap">
          {starterName}
        </Text>
      </Box>
    </Pressable>
  );
}
