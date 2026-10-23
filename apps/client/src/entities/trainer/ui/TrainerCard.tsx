import { Box } from '@chakra-ui/react';
import type { Trainer } from '@creatures/contracts/trainer';
import type { ReactElement } from 'react';

import { useSelectionRing } from '~/shared/theme';
import { IconButton } from '~/shared/ui/button';
import { IconClose, IconTeam } from '~/shared/ui/icon';
import { Pressable } from '~/shared/ui/interactive';
import { Text } from '~/shared/ui/text';

import { DELETE_BUTTON_SIZE, DELETE_ICON_SIZE } from './trainerCard.constants';

const GENDER_LABELS = {
  female: 'Feminino',
  male: 'Masculino',
} as const;

const AVATAR_SIZE = '2.25rem';

type TrainerCardProps = {
  isSelected: boolean;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  trainer: Trainer;
};

export function TrainerCard(props: TrainerCardProps): ReactElement {
  const { isSelected, onDelete, onSelect, trainer } = props;
  const genderLabel = GENDER_LABELS[trainer.gender];
  const subtitle = `${genderLabel} · Nível ${trainer.level}`;
  const deleteLabel = `Excluir ${trainer.name}`;

  function handleSelect(): void {
    onSelect(trainer.id);
  }

  function handleDelete(): void {
    onDelete(trainer.id);
  }

  const body = <TrainerCardBody isSelected={isSelected} name={trainer.name} subtitle={subtitle} />;

  return (
    <Box position="relative" width="full">
      <Pressable onPress={handleSelect} radius="sm" width="full">
        {body}
      </Pressable>
      <Box position="absolute" right="0.375rem" top="50%" transform="translateY(-50%)">
        <IconButton
          label={deleteLabel}
          onClick={handleDelete}
          radius="full"
          size={DELETE_BUTTON_SIZE}
          tone="dangerGhost"
        >
          <IconClose size={DELETE_ICON_SIZE} />
        </IconButton>
      </Box>
    </Box>
  );
}

type TrainerCardBodyProps = {
  isSelected: boolean;
  name: string;
  subtitle: string;
};

function TrainerCardBody(props: TrainerCardBodyProps): ReactElement {
  const { isSelected, name, subtitle } = props;
  const selectionRing = useSelectionRing();
  const ring = isSelected ? selectionRing : undefined;
  return (
    <Box
      _before={ring}
      alignItems="center"
      bg="bg.raised"
      borderRadius="sm"
      boxShadow="raised"
      display="flex"
      gap="3"
      p="2"
      paddingInlineEnd="3rem"
      position="relative"
      transitionProperty="box-shadow"
      transitionDuration="150ms"
      transitionTimingFunction="ease-out"
      width="full"
    >
      <TrainerAvatar />
      <Box flex="1" minW="0">
        <Text color="fg" overflow="hidden" variant="name" whiteSpace="nowrap">
          {name}
        </Text>
        <Text color="fg.muted" overflow="hidden" variant="meta" whiteSpace="nowrap">
          {subtitle}
        </Text>
      </Box>
    </Box>
  );
}

function TrainerAvatar(): ReactElement {
  return (
    <Box
      alignItems="center"
      bg="bg.sunken"
      borderRadius="full"
      boxShadow="recessed"
      color="fg.muted"
      display="flex"
      flexShrink="0"
      height={AVATAR_SIZE}
      justifyContent="center"
      width={AVATAR_SIZE}
    >
      <IconTeam />
    </Box>
  );
}
