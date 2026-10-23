import { Box, NumberInput } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { StoreQuantityButton } from '~/features/store/ui/StoreQuantityButton';
import { Text } from '~/shared/ui/text';

const QUANTITY_LABEL = 'Quantidade';
const INPUT_WIDTH = '4.5rem';
const DECREMENT_LABEL = 'Diminuir a quantidade';
const INCREMENT_LABEL = 'Aumentar a quantidade';

export type StoreQuantityFieldProps = {
  /** The field is closed when there is nothing to buy or to sell. */
  disabled: boolean;
  /** The biggest quantity the player can choose. */
  limit: number;
  /** The quantity is normalized when the field loses the focus. */
  onCommit(): void;
  /** The write in the field. */
  onChange(text: string): void;
  /** The text of the field, while the player writes it. */
  quantityText: string;
};

/**
 * The field of the quantity.
 *
 * O campo e o *stepper* do mobile: o `-` e o `+` dos dois lados, e o numero
 * no meio. Os botoes somam e tiram uma unidade, e nunca passam do limite: o
 * dinheiro que o jogador tem, na compra, e a quantidade que ele tem na
 * mochila, na venda.
 */
export function StoreQuantityField(props: StoreQuantityFieldProps): ReactElement {
  const { disabled, limit, onChange, onCommit, quantityText } = props;
  const change = buildQuantityChange(onChange);
  const commit = buildQuantityCommit(onCommit);
  return (
    <NumberInput.Root
      allowOverflow={false}
      disabled={disabled}
      max={limit}
      min={1}
      onValueChange={change}
      onValueCommit={commit}
      value={quantityText}
    >
      <Box alignItems="center" display="flex" gap="1">
        <NumberInput.DecrementTrigger asChild>
          <StoreQuantityButton aria-label={DECREMENT_LABEL} disabled={disabled}>
            <Text variant="label">−</Text>
          </StoreQuantityButton>
        </NumberInput.DecrementTrigger>
        <NumberInput.Input
          aria-label={QUANTITY_LABEL}
          bg="bg.sunken"
          borderColor="border"
          borderRadius="sm"
          borderWidth="1px"
          color="fg"
          focusVisibleRing="outside"
          fontSize="sm"
          height="2rem"
          paddingInline="2"
          textAlign="center"
          width={INPUT_WIDTH}
        />
        <NumberInput.IncrementTrigger asChild>
          <StoreQuantityButton aria-label={INCREMENT_LABEL} disabled={disabled}>
            <Text variant="label">+</Text>
          </StoreQuantityButton>
        </NumberInput.IncrementTrigger>
      </Box>
    </NumberInput.Root>
  );
}

/**
 * The write in the quantity field.
 */
function buildQuantityChange(
  onChange: (text: string) => void,
): (details: { value: string }) => void {
  return function changeQuantity(details: { value: string }): void {
    onChange(details.value);
  };
}

/**
 * O fim da escrita: o campo perde o foco ou o jogador aperta Enter, e a
 * quantidade vai para dentro do limite.
 */
function buildQuantityCommit(onCommit: () => void): () => void {
  return function commitQuantity(): void {
    onCommit();
  };
}
