import { Icon } from '~/shared/ui/Icon';

import { HuntAbility } from '../../api/hunt-protocol';
import { openAbilityModal } from '../../model/modal-store';
import { AbilityIcon } from './AbilityIcon';
import { Slot } from './Slot';

type AbilitySlotProps = { ability: HuntAbility | undefined; slot: number };

export function AbilitySlot(props: AbilitySlotProps): React.ReactElement {
  const { ability, slot } = props;
  const openModal = openAbilityModal.bind(undefined, slot);
  if (ability) {
    const { cooldownEndsAt, cooldownMs, element, name } = ability;
    const content = <AbilityIcon element={element} key={name} name={name} />;
    return (
      <Slot
        content={content}
        cooldownEndsAt={cooldownEndsAt}
        cooldownMs={cooldownMs}
        label={name}
        onClick={openModal}
      />
    );
  }
  const content = <Icon name="add" textStyle="2xl" />;
  return (
    <Slot
      content={content}
      cooldownEndsAt={undefined}
      cooldownMs={undefined}
      label="Habilidade"
      onClick={openModal}
    />
  );
}
