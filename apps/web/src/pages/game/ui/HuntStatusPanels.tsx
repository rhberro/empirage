/* eslint-disable max-lines, react/no-multi-comp, react/forbid-component-props, oxc/no-optional-chaining, oxsome/no-jsx-inline-computation, oxsome/no-inline-functions-objects-arrays */
import * as React from 'react';

import type { CollectionCreature } from '../api/game-protocol';
import type { HuntCommand } from '../api/hunt-protocol';
import { huntElementBackgroundColor } from '../lib/hunt-element-colors';
import {
  selectActiveCreatureElements,
  selectActiveCreatureExperience,
  selectActiveCreatureExperienceLevelStart,
  selectActiveCreatureExperienceNextLevel,
  selectActiveCreatureId,
  selectActiveCreatureName,
  selectActiveCreatureSpeciesId,
  selectActiveCreatureSwitchCompletesAt,
  selectActiveCreatureSwitchCooldownEndsAt,
  selectDisplayedTrainerAvatarUrl,
  selectDisplayedTrainerGold,
  selectDisplayedTrainerLevel,
  selectDisplayedTrainerName,
  selectHuntActiveCreatureLevel,
  selectParty,
  selectPartyCreatureHealth,
  selectPartyCreatureMaximumHealth,
  useGameStore,
} from '../model/game-store';
import { HuntStatusBar } from './HuntStatusBar';

type HuntStatusPanelsProps = { onCommand: (command: HuntCommand) => boolean };
type HuntPartyCardProps = {
  creature: CollectionCreature;
  isActive: boolean;
  onCommand: (command: HuntCommand) => boolean;
};
type CreatureSelectionButtonProps = React.PropsWithChildren<{
  creature: CollectionCreature;
  health: number;
  isActive: boolean;
  onCommand: (command: HuntCommand) => boolean;
}>;
type Party = Array<CollectionCreature>;
type AnimationCleanup = () => void;

export function HuntStatusPanels(props: HuntStatusPanelsProps): React.ReactElement {
  const { onCommand } = props;
  return (
    <div className="hunt-status">
      <TrainerStatus />
      <PartyStatus onCommand={onCommand} />
    </div>
  );
}

function TrainerStatus(): React.ReactElement {
  const avatarUrl = useGameStore(selectDisplayedTrainerAvatarUrl);
  const gold = useGameStore(selectDisplayedTrainerGold);
  const level = useGameStore(selectDisplayedTrainerLevel);
  const name = useGameStore(selectDisplayedTrainerName);
  const displayedGold = useOdometer(gold);
  if (!name || level === undefined) {
    return <div />;
  }
  const trainerInitial = name.slice(0, 1).toUpperCase();
  const trainerAvatar = avatarUrl ? (
    <img alt="" className="hunt-status__avatar-image" src={avatarUrl} />
  ) : (
    <span aria-hidden="true">{trainerInitial}</span>
  );
  return (
    <>
      <section className="hunt-status__panel hunt-status__trainer" aria-label="Treinador atual">
        <div className="hunt-status__avatar">{trainerAvatar}</div>
        <div>
          <strong>{name}</strong>
          <span>Nível {level}</span>
        </div>
      </section>
      <section className="hunt-status__money" aria-label="Dinheiro atual">
        <span aria-hidden="true">¤</span>
        <strong>{displayedGold.toLocaleString('pt-BR')}</strong>
      </section>
    </>
  );
}

function PartyStatus(props: HuntStatusPanelsProps): React.ReactElement {
  const { onCommand } = props;
  const activeCreatureId = useGameStore(selectActiveCreatureId);
  const party = useGameStore(selectParty);
  const displayedParty = partyForDisplay(party, activeCreatureId);
  return (
    <div className="hunt-status__party">
      <SwitchCooldown />
      {displayedParty.map(function renderPartyCard(creature): React.ReactElement {
        return (
          <HuntPartyCard
            creature={creature}
            isActive={creature.id === activeCreatureId}
            key={creature.id}
            onCommand={onCommand}
          />
        );
      })}
    </div>
  );
}

function SwitchCooldown(): React.ReactElement | null {
  const cooldownEndsAt = useGameStore(selectActiveCreatureSwitchCooldownEndsAt);
  const now = useCurrentTime();
  if (cooldownEndsAt === undefined || cooldownEndsAt <= now) {
    return null;
  }
  const seconds = Math.ceil((cooldownEndsAt - now) / 1_000);
  return <span className="hunt-status__switch-cooldown">Troca disponível em {seconds}s</span>;
}

function HuntPartyCard(props: HuntPartyCardProps): React.ReactElement {
  const { creature, isActive, onCommand } = props;
  const activeElements = useGameStore(selectActiveCreatureElements);
  const activeExperience = useGameStore(selectActiveCreatureExperience);
  const activeExperienceLevelStart = useGameStore(selectActiveCreatureExperienceLevelStart);
  const activeExperienceNextLevel = useGameStore(selectActiveCreatureExperienceNextLevel);
  const activeLevel = useGameStore(selectHuntActiveCreatureLevel);
  const activeName = useGameStore(selectActiveCreatureName);
  const activeSpeciesId = useGameStore(selectActiveCreatureSpeciesId);
  const health = usePartyCreatureHealth(creature.id);
  const maximumHealth = usePartyCreatureMaximumHealth(creature.id);
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
  const buttonContent = (
    <>
      <img alt="" className="hunt-status__creature-image" src={creatureIconUrl(speciesId)} />
      <div className="hunt-status__creature-details">
        <strong>{name}</strong>
        <span>Nível {level}</span>
        <span className="hunt-status__rarity">{rarityLabel(creature.rarity)}</span>
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

function CreatureSelectionButton(props: CreatureSelectionButtonProps): React.ReactElement {
  const { children, creature, health, isActive, onCommand } = props;
  const completesAt = useGameStore(selectActiveCreatureSwitchCompletesAt);
  const cooldownEndsAt = useGameStore(selectActiveCreatureSwitchCooldownEndsAt);
  const now = useCurrentTime();
  const canSwitch =
    !isActive &&
    health > 0 &&
    (cooldownEndsAt === undefined || (now >= cooldownEndsAt && !completesAt));
  function switchActiveCreature(): void {
    onCommand({ creatureId: creature.id, type: 'switch_active_creature', version: 1 });
  }
  return (
    <button
      aria-label={`Ativar ${creature.species.name}`}
      className="hunt-status__creature-select"
      disabled={!canSwitch}
      onClick={switchActiveCreature}
      type="button"
    >
      {children}
    </button>
  );
}

function usePartyCreatureHealth(creatureId: string): number | undefined {
  function selectHealth(
    state: Parameters<typeof selectPartyCreatureHealth>[0],
  ): number | undefined {
    return selectPartyCreatureHealth(state, creatureId);
  }
  return useGameStore(selectHealth);
}

function usePartyCreatureMaximumHealth(creatureId: string): number | undefined {
  function selectMaximumHealth(
    state: Parameters<typeof selectPartyCreatureMaximumHealth>[0],
  ): number | undefined {
    return selectPartyCreatureMaximumHealth(state, creatureId);
  }
  return useGameStore(selectMaximumHealth);
}

function useCurrentTime(): number {
  const [now, setNow] = React.useState(Date.now);
  function refresh(): AnimationCleanup {
    const timer = globalThis.setInterval(function updateTime(): void {
      setNow(Date.now());
    }, 250);
    function clearTimer(): void {
      globalThis.clearInterval(timer);
    }
    return clearTimer;
  }
  React.useEffect(refresh, []);
  return now;
}

function renderElement(element: string): React.ReactElement {
  const style = { backgroundColor: huntElementBackgroundColor(element) };
  return (
    <span className="hunt-status__element" key={element} style={style}>
      {element}
    </span>
  );
}

function useOdometer(value: number): number {
  const [displayed, setDisplayed] = React.useState(value);
  const previous = React.useRef(value);
  const frame = React.useRef(0);
  function animateValue(): AnimationCleanup | undefined {
    const from = previous.current;
    if (from === value) {
      return;
    }
    const duration = 420;
    const startedAt = globalThis.performance.now();
    function render(now: number): void {
      const progress = Math.min(1, (now - startedAt) / duration);
      setDisplayed(Math.round(from + (value - from) * progress));
      if (progress < 1) {
        frame.current = globalThis.requestAnimationFrame(render);
      }
    }
    previous.current = value;
    frame.current = globalThis.requestAnimationFrame(render);
    function stopAnimation(): void {
      globalThis.cancelAnimationFrame(frame.current);
    }
    return stopAnimation;
  }
  React.useEffect(animateValue, [value]);
  return displayed;
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

function partyForDisplay(party: Party, activeCreatureId: string | null | undefined): Party {
  const activeCreature = party.find(function findActiveCreature(creature): boolean {
    return creature.id === activeCreatureId;
  });
  if (!activeCreature) {
    return party;
  }
  const remainingParty = party.filter(function withoutActiveCreature(creature): boolean {
    return creature.id !== activeCreature.id;
  });
  return [activeCreature, ...remainingParty];
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
