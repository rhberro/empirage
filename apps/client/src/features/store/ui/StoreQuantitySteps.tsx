import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { StoreQuantityButton } from '~/features/store/ui/StoreQuantityButton';
import { Text } from '~/shared/ui/text';

const QUANTITY_STEPS: readonly number[] = [10, 100, 1000];
const MAX_LABEL = 'MAX';

export type StoreQuantityStepsProps = {
  /** The buttons are closed when there is nothing to buy or to sell. */
  disabled: boolean;
  /** The biggest quantity the player can choose. */
  limit: number;
  /** Adds a step to the quantity of the field. */
  onStep(step: number): void;
  /** Puts the quantity in the limit. */
  onMax(): void;
};

/**
 * The buttons of the sum of the quantity.
 *
 * The step adds to what the field already holds, and it stops at the limit of
 * the quantity. O `MAX` e o limite: na compra, o maior numero que o dinheiro
 * paga; na venda, a quantidade que o jogador tem na mochila. Os botoes fecham
 * quando o campo fecha: nada selecionado e nada para maximizar.
 */
export function StoreQuantitySteps(props: StoreQuantityStepsProps): ReactElement {
  const { disabled, limit, onMax, onStep } = props;
  const isStepDisabled = disabled || limit <= 0;
  const buttons = QUANTITY_STEPS.map(buildStepRenderer(onStep, isStepDisabled));
  const isMaxDisabled = disabled || limit <= 0;
  const max = (
    <StoreQuantityButton disabled={isMaxDisabled} onClick={onMax}>
      <Text variant="label">{MAX_LABEL}</Text>
    </StoreQuantityButton>
  );
  return (
    <Box alignItems="center" display="flex" gap="1">
      {buttons}
      {max}
    </Box>
  );
}

function buildStepRenderer(
  onStep: (step: number) => void,
  disabled: boolean,
): (value: number) => ReactElement {
  return function renderButton(value: number): ReactElement {
    const onClick = buildStepClick(onStep, value);
    const label = `+${value}`;
    return (
      <StoreQuantityButton key={value} disabled={disabled} onClick={onClick}>
        <Text variant="label">{label}</Text>
      </StoreQuantityButton>
    );
  };
}

/**
 * The click on a step of the sum: the step adds to what the field already
 * holds.
 */
function buildStepClick(onStep: (step: number) => void, value: number): () => void {
  return function addStep(): void {
    onStep(value);
  };
}
