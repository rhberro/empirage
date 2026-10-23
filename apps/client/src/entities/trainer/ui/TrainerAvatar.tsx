import { Box } from '@chakra-ui/react';
import type { Gender } from '@creatures/contracts/trainer';
import type { ReactElement } from 'react';

const AVATAR_SYMBOLS = {
  female: '♀',
  male: '♂',
} as const;

const AVATAR_COLORS = {
  female: 'frost.400',
  male: 'arcane.emphasized',
} as const;

type TrainerAvatarProps = {
  gender: Gender;
};

export function TrainerAvatar(props: TrainerAvatarProps): ReactElement {
  const { gender } = props;
  const color = AVATAR_COLORS[gender];
  const symbol = AVATAR_SYMBOLS[gender];
  return (
    <Box
      alignItems="center"
      alignSelf="center"
      bg={color}
      borderRadius="full"
      boxShadow="inner"
      color="base.950"
      display="flex"
      fontSize="4xl"
      height="5.5rem"
      justifyContent="center"
      width="5.5rem"
    >
      {symbol}
    </Box>
  );
}
