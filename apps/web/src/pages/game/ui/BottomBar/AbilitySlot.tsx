import { Icon } from '~/shared/ui/Icon';

import { selectHuntActiveCreatureAbilityBySlot, useGameStore } from '../../model/game-store';
import { openAbilityModal } from '../../model/modal-store';
import { AbilityIcon } from './AbilityIcon';
import { Slot } from './Slot';

type AbilitySlotProps = { slot: number };

export function AbilitySlot(props: AbilitySlotProps): React.ReactElement {
  const { slot } = props;
  const abilitySelector = selectHuntActiveCreatureAbilityBySlot.bind(null, slot);
  const ability = useGameStore(abilitySelector);
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
  const content = <Icon name="add_2" textStyle="2xl" />;
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
