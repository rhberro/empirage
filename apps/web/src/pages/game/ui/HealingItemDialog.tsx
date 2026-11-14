import { Dialog, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { HealingConfiguration, HealingItem, HuntCommand } from '../api/hunt-protocol';
import type { HealingConfigurationInput } from '../model/healing-configuration';
import {
  selectHealingItemModalState,
  toggleHealingItemModal,
  useModalStore,
} from '../model/modal-store';
import { HealingItemDialogForm } from './HealingItemDialogForm';

type HealingItemDialogProps = {
  configuration: HealingConfiguration | undefined;
  items: Array<HealingItem>;
  onConfigure: (command: HuntCommand) => boolean;
};
const healingDialogHeight = { base: 'calc(100dvh - 4)', md: 'min(42rem, calc(100dvh - 8))' };
export function HealingItemDialog(props: HealingItemDialogProps): React.ReactElement {
  const { configuration, items, onConfigure } = props;
  const open = useModalStore(selectHealingItemModalState);
  const defaultValues = getDefaultValues(configuration);
  const formKey = getFormKey(open, defaultValues);
  return (
    <Dialog.Root lazyMount onOpenChange={toggleHealingItemModal} open={open} size="md">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          display="flex"
          flexDirection="column"
          h={healingDialogHeight}
          overflow="hidden"
        >
          <Dialog.Header>
            <Stack gap="1">
              <Text color="brand.solid" fontSize="xs" fontWeight="bold" letterSpacing="widest">
                CONFIGURAÇÃO DE CAÇA
              </Text>
              <Dialog.Title>Cura automática</Dialog.Title>
            </Stack>
          </Dialog.Header>
          <HealingItemDialogForm
            defaultValues={defaultValues}
            formKey={formKey}
            items={items}
            onConfigure={onConfigure}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

function getDefaultValues(
  configuration: HealingConfiguration | undefined,
): HealingConfigurationInput {
  const configuredItemId = configuration ? configuration.itemId : undefined;
  const configuredThreshold = configuration ? configuration.thresholdPercentage : undefined;
  const itemId = configuredItemId ?? 0;
  const thresholdPercentage = configuredThreshold ?? 50;
  return { itemId: String(itemId), thresholdPercentage: String(thresholdPercentage) };
}

function getFormKey(open: boolean, values: HealingConfigurationInput): string {
  return String(open) + '-' + values.itemId + '-' + values.thresholdPercentage;
}
