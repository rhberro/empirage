import { Box } from '@chakra-ui/react';
import type {
  EquippedAbility,
  EquippedConsumable,
  EquippedDevice,
} from '@creatures/contracts/skill';
import type { ReactElement } from 'react';

import { Text } from '~/shared/ui/text';
import { readElementPresentation } from '~/widgets/game-hud/model/element';

/**
 * The color of the bar of an ability whose element the interface does not
 * know: the neutral color of the interface, because the bar is not a claim
 * about the element.
 */
const ELEMENT_FALLBACK_COLOR = 'fg.subtle';

const CONSUMABLE_COLOR = 'verdant.fg';
const DEVICE_COLOR = 'frost.fg';

type AbilityContentProps = {
  ability: EquippedAbility;
};

/**
 * The content of a slot of ability: the name of the ability and its element.
 *
 * The cooldown is not drawn: the hunt that puts it in motion does not exist
 * yet, and a number that never counts down would be a lie.
 */
export function AbilityContent(props: AbilityContentProps): ReactElement {
  const { ability } = props;
  const color = readElementColor(ability.element);
  const label = readElementLabel(ability.element);
  const labelNode =
    label === null ? null : (
      <Text color="fg.subtle" overflow="hidden" textOverflow="ellipsis" variant="meta">
        {label}
      </Text>
    );
  return (
    <Box display="flex" flexDirection="column" height="full" padding="1">
      <Box bg={color} borderRadius="xs" height="0.1875rem" width="full" />
      <Text
        color="fg"
        marginBlockStart="1"
        overflow="hidden"
        textOverflow="ellipsis"
        variant="meta"
        whiteSpace="nowrap"
      >
        {ability.name}
      </Text>
      {labelNode}
    </Box>
  );
}

type ConsumableContentProps = {
  consumable: EquippedConsumable;
};

/**
 * The content of a slot of consumable: the name of the consumable and the life
 * that triggers it.
 */
export function ConsumableContent(props: ConsumableContentProps): ReactElement {
  const { consumable } = props;
  const trigger = `Usa com ${consumable.triggerHpPercent}%`;
  return (
    <Box display="flex" flexDirection="column" height="full" padding="1">
      <Box bg={CONSUMABLE_COLOR} borderRadius="xs" height="0.1875rem" width="full" />
      <Text
        color="fg"
        marginBlockStart="1"
        overflow="hidden"
        textOverflow="ellipsis"
        variant="meta"
        whiteSpace="nowrap"
      >
        {consumable.name}
      </Text>
      <Text color="fg.subtle" overflow="hidden" textOverflow="ellipsis" variant="meta">
        {trigger}
      </Text>
    </Box>
  );
}

type DeviceContentProps = {
  device: EquippedDevice;
};

/**
 * The content of the slot of the capture device.
 */
export function DeviceContent(props: DeviceContentProps): ReactElement {
  const { device } = props;
  return (
    <Box display="flex" flexDirection="column" height="full" padding="1">
      <Box bg={DEVICE_COLOR} borderRadius="xs" height="0.1875rem" width="full" />
      <Text
        color="fg"
        marginBlockStart="1"
        overflow="hidden"
        textOverflow="ellipsis"
        variant="meta"
        whiteSpace="nowrap"
      >
        {device.name}
      </Text>
    </Box>
  );
}

function readElementColor(element: EquippedAbility['element']): string {
  const presentation = readElementPresentation(element);
  return presentation === null ? ELEMENT_FALLBACK_COLOR : presentation.color;
}

function readElementLabel(element: EquippedAbility['element']): string | null {
  const presentation = readElementPresentation(element);
  return presentation === null ? null : presentation.label;
}
