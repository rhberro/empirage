import { Box, NumberInput } from '@chakra-ui/react';
import type { ReactElement } from 'react';

import { StoreQuantityButton } from '~/features/store/ui/StoreQuantityButton';
import { Text } from '~/shared/ui/text';

const TRIGGER_STEP = 5;
const MIN_TRIGGER = 5;
const MAX_TRIGGER = 95;

type TriggerControlProps = {
  onChange: (percent: number) => void;
  percent: number;
};

// eslint-disable-next-line max-lines-per-function
export function TriggerControl(props: TriggerControlProps): ReactElement {
  const { onChange, percent } = props;
  const valueText = String(percent);

  function decrease(): void {
    onChange(clamp(percent - TRIGGER_STEP));
  }

  function increase(): void {
    onChange(clamp(percent + TRIGGER_STEP));
  }

  function handleChange(details: { valueAsNumber: number }): void {
    if (!Number.isNaN(details.valueAsNumber)) {
      onChange(clamp(details.valueAsNumber));
    }
  }

  return (
    <Box alignItems="center" display="flex" gap="3" justifyContent="space-between" width="full">
      <Text color="fg.muted" variant="meta">
        Usar quando a vida for menor que
      </Text>
      <NumberInput.Root
        allowOverflow={false}
        max={MAX_TRIGGER}
        min={MIN_TRIGGER}
        onValueChange={handleChange}
        step={TRIGGER_STEP}
        value={valueText}
      >
        <Box alignItems="center" display="flex" gap="1">
          <StoreQuantityButton aria-label="Diminuir" onClick={decrease}>
            <Text variant="label">−</Text>
          </StoreQuantityButton>
          <NumberInput.Input
            aria-label="Gatilho de vida"
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
            width="4.5rem"
          />
          <StoreQuantityButton aria-label="Aumentar" onClick={increase}>
            <Text variant="label">+</Text>
          </StoreQuantityButton>
        </Box>
      </NumberInput.Root>
    </Box>
  );
}

function clamp(percent: number): number {
  if (percent < MIN_TRIGGER) {
    return MIN_TRIGGER;
  }
  if (percent > MAX_TRIGGER) {
    return MAX_TRIGGER;
  }
  return percent;
}
