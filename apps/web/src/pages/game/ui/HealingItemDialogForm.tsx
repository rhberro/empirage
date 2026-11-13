import * as React from 'react';

import { createForm } from '~/shared/ui/Form';

import type { HealingItem, HuntCommand } from '../api/hunt-protocol';
import {
  type HealingConfigurationInput,
  HealingConfigurationSchema,
  type HealingConfigurationOutput,
} from '../model/healing-configuration';
import { toggleHealingItemModal } from '../model/modal-store';
import { HealingItemDialogFields } from './HealingItemDialogFields';

type HealingItemDialogFormProps = {
  defaultValues: HealingConfigurationInput;
  formKey: string;
  items: Array<HealingItem>;
  onConfigure: (command: HuntCommand) => boolean;
};

const Form = createForm(HealingConfigurationSchema);

export function HealingItemDialogForm(props: HealingItemDialogFormProps): React.ReactElement {
  const { defaultValues, formKey, items, onConfigure } = props;
  function saveConfiguration(values: HealingConfigurationOutput): void {
    const command: HuntCommand = {
      healingItemId: Number(values.itemId),
      healingThresholdPercentage: Number(values.thresholdPercentage),
      type: 'configure_healing_item',
      version: 1,
    };
    if (onConfigure(command)) {
      toggleHealingItemModal();
    }
  }
  return (
    <Form key={formKey} defaultValues={defaultValues} onSubmit={saveConfiguration}>
      <HealingItemDialogFields items={items} />
    </Form>
  );
}
