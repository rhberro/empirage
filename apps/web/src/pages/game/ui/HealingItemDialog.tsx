import { Dialog } from '@chakra-ui/react';
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
export function HealingItemDialog(props: HealingItemDialogProps): React.ReactElement {
  const { configuration, items, onConfigure } = props;
  const open = useModalStore(selectHealingItemModalState);
  const defaultValues = getDefaultValues(configuration);
  const formKey = getFormKey(open, defaultValues);
  return (
    <Dialog.Root lazyMount onOpenChange={toggleHealingItemModal} open={open} size="xs">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Cura Automática</Dialog.Title>
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
