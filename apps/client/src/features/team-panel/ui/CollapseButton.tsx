import { Center } from '@chakra-ui/react';

import { IconButton } from '~/shared/ui/button';
import { IconChevronRight } from '~/shared/ui/icon';

type CollapseButtonProps = { onToggle(): void };

export function CollapseButton(props: CollapseButtonProps): React.ReactElement {
  const { onToggle } = props;
  return (
    <IconButton label="Mostrar ou esconder equipe" borderRadius="none" onClick={onToggle}>
      <Center className="toggle">
        <IconChevronRight />
      </Center>
    </IconButton>
  );
}
