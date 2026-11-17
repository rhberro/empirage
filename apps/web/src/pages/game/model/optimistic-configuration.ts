import type { CollectionStateEvent } from '../api/game-protocol';
import type {
  BattleConfiguration,
  HuntAbility,
  HuntAvailableAbility,
  HuntCommand,
  HuntState,
} from '../api/hunt-protocol';

type Collection = CollectionStateEvent['collection'];
type Abilities = Array<HuntAbility>;
type ConfigureAbilityCommand = Extract<HuntCommand, { type: 'configure_ability' }>;

function compareSlot(first: HuntAbility, second: HuntAbility): number {
  return first.slot - second.slot;
}

export function optimisticCollectionConfiguration(
  collection: Collection,
  command: HuntCommand,
): Collection {
  if (!collection.configuration) {
    return collection;
  }
  const configuration = optimisticConfiguration(collection.configuration, command);
  if (configuration === collection.configuration) {
    return collection;
  }
  if (command.type !== 'configure_ability' || !collection.activeCreatureId) {
    return { ...collection, configuration };
  }
  const current = collection.partyConfigurations
    ? collection.partyConfigurations[collection.activeCreatureId]
    : undefined;
  if (!current) {
    return { ...collection, configuration };
  }
  const partyConfigurations = {
    ...collection.partyConfigurations,
    [collection.activeCreatureId]: {
      ...current,
      activeCreatureAbilities: configuration.activeCreatureAbilities,
    },
  };
  return { ...collection, configuration, partyConfigurations };
}

export function optimisticHuntConfiguration(hunt: HuntState, command: HuntCommand): HuntState {
  if (command.type === 'configure_wave_range') {
    const waveRange = {
      maximumSize: command.waveRangeMaximumSize,
      minimumSize: command.waveRangeMinimumSize,
    };
    return { ...hunt, waveRange };
  }
  const configuration = optimisticConfiguration(hunt, command);
  if (configuration === hunt) {
    return hunt;
  }
  return { ...hunt, ...configuration };
}

function optimisticConfiguration(
  configuration: BattleConfiguration,
  command: HuntCommand,
): BattleConfiguration {
  if (command.type === 'configure_healing_item') {
    const healingConfiguration =
      command.healingItemId === 0
        ? undefined
        : {
            itemId: command.healingItemId,
            thresholdPercentage: command.healingThresholdPercentage,
          };
    return { ...configuration, healingConfiguration };
  }
  if (command.type === 'configure_capture') {
    const captureConfiguration =
      command.captureItemId === 0
        ? undefined
        : { itemId: command.captureItemId, rarities: command.captureRarities };
    return { ...configuration, captureConfiguration };
  }
  if (command.type !== 'configure_ability') {
    return configuration;
  }
  const abilities = optimisticAbilities(
    configuration.activeCreatureAbilities,
    command,
    configuration,
  );
  if (abilities === configuration.activeCreatureAbilities) {
    return configuration;
  }
  return { ...configuration, activeCreatureAbilities: abilities };
}

function optimisticAbilities(
  equipped: Abilities,
  command: ConfigureAbilityCommand,
  configuration: BattleConfiguration,
): Abilities {
  function keepAbility(ability: HuntAbility): boolean {
    return ability.slot !== command.abilitySlot && ability.id !== command.abilityId;
  }
  const remaining = equipped.filter(keepAbility);
  if (command.abilityId === null) {
    return remaining;
  }
  function findAvailableAbility(ability: HuntAvailableAbility): boolean {
    return ability.id === command.abilityId;
  }
  const available = configuration.activeCreatureAvailableAbilities.find(findAvailableAbility);
  if (!available) {
    return equipped;
  }
  const selected = { ...available, cooldownEndsAt: 0, slot: command.abilitySlot };
  const next = [...remaining, selected];
  return next.toSorted(compareSlot);
}
