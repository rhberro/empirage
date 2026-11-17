import { Icon } from '~/shared/ui/Icon';

import { HuntAbility } from '../../api/hunt-protocol';
import { selectHuntActiveCreatureAbilities, useGameStore } from '../../model/game-store';
import { openAbilityModal } from '../../model/modal-store';
import { AbilityIcon } from './AbilityIcon';
import { Slot } from './Slot';

type AbilitySlotProps = { slot: number };
type HuntAbilities = Array<HuntAbility>;

export function AbilitySlot(props: AbilitySlotProps): React.ReactElement {
  const { slot } = props;
  const abilities = useGameStore(selectHuntActiveCreatureAbilities);
  const ability = findAbilityBySlot(abilities, slot);
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

function findAbilityBySlot(abilities: HuntAbilities, slot: number): HuntAbility | undefined {
  for (const ability of abilities) {
    if (ability.slot === slot) {
      return ability;
    }
  }
  return undefined;
}
