import { z } from 'zod';

const healingConfigurationFields = {
  itemId: z.string().refine(isHealingItemId, 'Selecione uma medicina.'),
  thresholdPercentage: z.string().refine(isHealingThreshold, 'Informe um valor entre 5 e 100.'),
};

export const HealingConfigurationSchema = z.object(healingConfigurationFields);

export type HealingConfigurationInput = z.input<typeof HealingConfigurationSchema>;
export type HealingConfigurationOutput = z.output<typeof HealingConfigurationSchema>;

function isHealingItemId(value: string): boolean {
  const itemId = Number(value);
  return Number.isSafeInteger(itemId) && itemId >= 0;
}

function isHealingThreshold(value: string): boolean {
  const threshold = Number(value);
  return Number.isSafeInteger(threshold) && threshold >= 5 && threshold <= 100;
}
