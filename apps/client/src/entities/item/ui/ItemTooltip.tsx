import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { IconCoin } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

export type ItemTooltipProps = {
  /** The description of the item. */
  description: string;
  /** The name of the item. */
  name: string;
  /** The value of the item, quando a loja negocia ele. */
  value?: number | null;
  /** The label of the value: o que o numero significa. */
  valueLabel?: string;
};

/**
 * The popup of an item.
 *
 * O popup de um item e o resumo dele: o nome, o que o item faz e o que ele
 * vale. O preco so aparece quando a loja negocia o item: um drop que o
 * treinador vende na loja nao tem preco de compra, e mostrar um valor que o
 * jogador nao pode gastar seria mentira.
 */
export function ItemTooltip(props: ItemTooltipProps): ReactElement {
  const { description, name, value = null, valueLabel = 'Valor na loja' } = props;
  const valueNode = value === null ? null : <ItemValue label={valueLabel} value={value} />;
  return (
    <Box display="flex" flexDirection="column" gap="1" minW="11rem">
      <Text variant="name">{name}</Text>
      <Text color="fg.muted" variant="body">
        {description}
      </Text>
      {valueNode}
    </Box>
  );
}

type ItemValueProps = {
  label: string;
  value: number;
};

/**
 * The value of the item, in gold coins.
 *
 * O valor nunca vem sozinho: a moeda e o rotulo dizem o que ele e.
 */
function ItemValue(props: ItemValueProps): ReactElement {
  const { label, value } = props;
  return (
    <Box alignItems="center" display="flex" gap="1" marginBlockStart="1">
      <Box color="currency.gold" display="flex">
        <IconCoin size="0.8rem" />
      </Box>
      <Text color="currency.gold" variant="numeric">
        {value}
      </Text>
      <Text color="fg.subtle" variant="meta">
        {label}
      </Text>
    </Box>
  );
}
