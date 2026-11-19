import * as React from 'react';

import type { CollectionCreature } from '../../api/game-protocol';
import type { HuntCommand } from '../../api/hunt-protocol';
import { huntElementBackgroundColor } from '../../lib/hunt-element-colors';
import {
  selectActiveCreatureElements,
  selectActiveCreatureExperience,
  selectActiveCreatureExperienceLevelStart,
  selectActiveCreatureExperienceNextLevel,
  selectActiveCreatureName,
  selectActiveCreatureSpeciesId,
  selectHuntActiveCreatureLevel,
  selectPartyCreatureHealth,
  selectPartyCreatureMaximumHealth,
  useGameStore,
} from '../../model/game-store';
import { HuntStatusBar } from '../HuntStatusBar';
import { CreatureSelectionButton } from './CreatureSelectionButton';

type HuntPartyCardProps = {
  creature: CollectionCreature;
  isActive: boolean;
  onCommand: (command: HuntCommand) => boolean;
};

function renderElement(element: string): React.ReactElement {
  const style = { backgroundColor: huntElementBackgroundColor(element) };
  return (
    <span className="hunt-status__element" key={element} style={style}>
      {element}
    </span>
  );
}

function percentage(current: number, maximum: number): number {
  return Math.max(0, Math.min(100, (current / Math.max(1, maximum)) * 100));
}

function experiencePercentage(
  currentExperience: string,
  experienceLevelStart: string,
  experienceNextLevel: string,
): number {
  const current = BigInt(currentExperience);
  const start = BigInt(experienceLevelStart);
  const next = BigInt(experienceNextLevel);
  const interval = next - start;
  if (interval <= 0n) {
    return 100;
  }
  const percentageValue = Number(((current - start) * 10_000n) / interval) / 100;
  return Math.max(0, Math.min(100, percentageValue));
}

function experiencePercentageForCreature(creature: CollectionCreature): number {
  return experiencePercentage(
    creature.experience,
    creature.experienceLevelStart,
    creature.experienceNextLevel,
  );
}

function maximumHealthForCreature(creature: CollectionCreature): number {
  const base = creature.species.base_hp;
  return Math.floor(((base * 2 + creature.ivHealth) * creature.level) / 100) + creature.level + 10;
}

function creatureIconUrl(speciesId: number): string {
  return `/assets/creatures/icons/${speciesId}.png`;
}

function rarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    common: 'Comum',
    epic: 'Épica',
    legendary: 'Lendária',
    rare: 'Rara',
    uncommon: 'Incomum',
  };
  return labels[rarity] ?? rarity;
}

export const HuntPartyCard = React.memo(HuntPartyCardComponent);

function HuntPartyCardComponent(props: HuntPartyCardProps): React.ReactElement {
  const { creature, isActive, onCommand } = props;

  const activeElements = useGameStore(selectActiveCreatureElements);
  const activeExperience = useGameStore(selectActiveCreatureExperience);
  const activeExperienceLevelStart = useGameStore(selectActiveCreatureExperienceLevelStart);
  const activeExperienceNextLevel = useGameStore(selectActiveCreatureExperienceNextLevel);
  const activeLevel = useGameStore(selectHuntActiveCreatureLevel);
  const activeName = useGameStore(selectActiveCreatureName);
  const activeSpeciesId = useGameStore(selectActiveCreatureSpeciesId);

  function selectHealth(
    state: Parameters<typeof selectPartyCreatureHealth>[0],
  ): number | undefined {
    return selectPartyCreatureHealth(state, creature.id);
  }
  function selectMaximumHealth(
    state: Parameters<typeof selectPartyCreatureMaximumHealth>[0],
  ): number | undefined {
    return selectPartyCreatureMaximumHealth(state, creature.id);
  }

  const health = useGameStore(selectHealth);
  const maximumHealth = useGameStore(selectMaximumHealth);
  const displayedHealth = health ?? maximumHealthForCreature(creature);
  const displayedMaximumHealth = maximumHealth ?? maximumHealthForCreature(creature);

  const name = isActive ? (activeName ?? creature.species.name) : creature.species.name;
  const level = isActive ? (activeLevel ?? creature.level) : creature.level;
  const elements = isActive ? (activeElements ?? creature.elements) : creature.elements;
  const experience =
    isActive && activeExperience && activeExperienceLevelStart && activeExperienceNextLevel
      ? experiencePercentage(
          activeExperience,
          activeExperienceLevelStart,
          activeExperienceNextLevel,
        )
      : experiencePercentageForCreature(creature);
  const speciesId = isActive ? (activeSpeciesId ?? creature.species.id) : creature.species.id;
  const elementsContent = elements.map(renderElement);
  const healthPercentage = percentage(displayedHealth, displayedMaximumHealth);
  const iconUrl = creatureIconUrl(speciesId);
  const rarityText = rarityLabel(creature.rarity);

  const buttonContent = (
    <>
      <img alt="" className="hunt-status__creature-image" src={iconUrl} />
      <div className="hunt-status__creature-details">
        <strong>{name}</strong>
        <span>Nível {level}</span>
        <span className="hunt-status__rarity">{rarityText}</span>
        <HuntStatusBar label="HP" value={healthPercentage} />
        <HuntStatusBar label="EXP" value={experience} />
        <div className="hunt-status__elements">{elementsContent}</div>
      </div>
    </>
  );

  const className = `hunt-status__panel hunt-status__creature hunt-status__creature--party${
    isActive ? ' hunt-status__creature--active' : ''
  }`;

  return (
    <section aria-label={creature.species.name} className={className}>
      <CreatureSelectionButton
        creature={creature}
        health={displayedHealth}
        isActive={isActive}
        onCommand={onCommand}
      >
        {buttonContent}
      </CreatureSelectionButton>
    </section>
  );
}
