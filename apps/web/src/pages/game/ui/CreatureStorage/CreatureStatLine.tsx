import { Text } from '@chakra-ui/react';
import * as React from 'react';

type CreatureStatLineProps = { label: string; values: Array<number> };

export function CreatureStatLine(props: CreatureStatLineProps): React.ReactElement {
  const { label, values } = props;
  const valueLabel = `HP ${values[0]} · ATQ ${values[1]} · DEF ${values[2]} · SpA ${values[3]} · SpD ${values[4]} · VEL ${values[5]}`;
  return (
    <Text fontSize="2xs">
      {label}: {valueLabel}
    </Text>
  );
}
