import { Box } from '@chakra-ui/react';
import type { Element } from '@creatures/contracts/species';
import type { ReactElement, ReactNode } from 'react';

import { IconBolt } from '~/shared/ui/icon';
import { Pressable } from '~/shared/ui/interactive';
import { Text } from '~/shared/ui/text';
import { readElementPresentation } from '~/widgets/game-hud/model/element';

export type AbilityCardProps = {
  cooldownMs?: number;
  damage?: number;
  description?: string | null;
  element?: Element;
  image?: ReactNode;
  name: string;
  onSelect?: () => void;
  selected?: boolean;
};

// eslint-disable-next-line max-lines-per-function
export function AbilityCard(props: AbilityCardProps): ReactElement {
  const {
    cooldownMs,
    damage,
    description,
    element,
    image,
    name,
    onSelect,
    selected = false,
  } = props;
  const presentation = readElementPresentation(element);
  const elementLabel = presentation === null ? (element ?? '') : presentation.label;
  const elementColor = presentation === null ? 'fg.subtle' : presentation.color;
  const cooldownText =
    cooldownMs === undefined ? null : `Cooldown: ${Math.round(cooldownMs / 1000)}s`;
  const damageText = damage === undefined ? null : `Dano: ${damage}`;
  const imageNode = image ?? (
    <Box
      alignItems="center"
      color={elementColor}
      display="flex"
      height="full"
      justifyContent="center"
      width="full"
    >
      <IconBolt />
    </Box>
  );
  const descriptionNode =
    description === null || description === undefined || description.trim() === '' ? null : (
      <Text color="fg.muted" variant="body">
        {description}
      </Text>
    );
  const elementNode =
    element === undefined ? null : (
      <>
        <Box bg={elementColor} borderRadius="xs" height="0.625rem" width="0.625rem" />
        <Text color="fg.muted" variant="meta">
          {elementLabel}
        </Text>
      </>
    );
  const cooldownNode =
    cooldownText === null ? null : (
      <Text color="fg.subtle" variant="meta">
        {cooldownText}
      </Text>
    );
  const damageNode =
    damageText === null ? null : (
      <Text color="fg" variant="meta">
        {damageText}
      </Text>
    );
  const borderColor = selected ? 'state.selected' : 'border';
  const body = (
    <Box
      borderColor={borderColor}
      borderRadius="sm"
      borderWidth="1px"
      display="flex"
      gap="3"
      padding="3"
      width="full"
    >
      <Box bg="bg.sunken" borderRadius="sm" height="3rem" overflow="hidden" width="3rem">
        {imageNode}
      </Box>
      <Box display="flex" flex="1" flexDirection="column" gap="1" minW="0">
        <Text variant="name">{name}</Text>
        {descriptionNode}
        <Box alignItems="center" display="flex" gap="2">
          {elementNode}
          {damageNode}
          {cooldownNode}
        </Box>
      </Box>
    </Box>
  );
  if (onSelect === undefined) {
    return body;
  }
  return (
    <Pressable onPress={onSelect} width="full">
      {body}
    </Pressable>
  );
}
