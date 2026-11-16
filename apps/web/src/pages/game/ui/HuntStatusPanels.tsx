/* eslint-disable max-lines, react/no-multi-comp, react/forbid-component-props, oxc/no-optional-chaining, oxsome/no-jsx-inline-computation, oxsome/no-inline-functions-objects-arrays */
import * as React from 'react';

import type {
  CharacterProfile,
  CollectionCreature,
  CollectionStateEvent,
} from '../api/game-protocol';
import type { HuntState } from '../api/hunt-protocol';
import type { HuntCommand } from '../api/hunt-protocol';
import { huntElementBackgroundColor } from '../lib/hunt-element-colors';
import { HuntStatusBar } from './HuntStatusBar';

type HuntStatusPanelsProps = {
  collection: CollectionStateEvent['collection'] | null;
  hunt: HuntState | null;
  onCommand: (command: HuntCommand) => boolean;
  profile: CharacterProfile | null;
};
type HuntPartyCardProps = {
  creature: CollectionCreature;
  canSwitch: boolean;
  health: number;
  hunt: HuntState | null;
  isActive: boolean;
  maximumHealth: number;
  onCommand: (command: HuntCommand) => boolean;
};
type CreatureStatus = {
  elements: Array<string>;
  experiencePercentage: number;
  level: number;
  name: string;
};
type CreatureHealth = { health: number; maximumHealth: number };
type Party = Array<CollectionCreature>;
type AnimationCleanup = () => void;

export function HuntStatusPanels(props: HuntStatusPanelsProps): React.ReactElement {
  const { collection, hunt, onCommand, profile } = props;
  const now = useCurrentTime();
  const status = hunt ? profileFromHunt(hunt) : profile;
  const displayedGold = useOdometer(status?.gold ?? 0);
  if (!status) {
    return <div />;
  }
  const trainerInitial = status.name.slice(0, 1).toUpperCase();
  const trainerAvatar = status.avatarUrl ? (
    <img alt="" className="hunt-status__avatar-image" src={status.avatarUrl} />
  ) : (
    <span aria-hidden="true">{trainerInitial}</span>
  );
  const displayedGoldLabel = displayedGold.toLocaleString('pt-BR');
  const activeCreatureId = hunt ? hunt.activeCreatureId : collection?.activeCreatureId;
  const party = partyForDisplay(collection?.party ?? [], activeCreatureId);
  const cooldownSeconds = switchCooldownSeconds(hunt, now);
  const cooldownLabel = cooldownSeconds === null ? null : `Troca disponível em ${cooldownSeconds}s`;
  return (
    <div className="hunt-status">
      <section className="hunt-status__panel hunt-status__trainer" aria-label="Treinador atual">
        <div className="hunt-status__avatar">{trainerAvatar}</div>
        <div>
          <strong>{status.name}</strong>
          <span>Nível {status.level}</span>
        </div>
      </section>
      <div className="hunt-status__party">
        {cooldownLabel ? (
          <span className="hunt-status__switch-cooldown">{cooldownLabel}</span>
        ) : null}
        {party.map(function renderPartyCard(creature): React.ReactElement {
          const isActive = creature.id === activeCreatureId;
          const health = healthForCreature(creature, hunt);
          return (
            <HuntPartyCard
              canSwitch={
                !isActive &&
                health.health > 0 &&
                (!hunt ||
                  (now >= hunt.activeCreatureSwitchCooldownEndsAt &&
                    hunt.activeCreatureSwitchCompletesAt === undefined))
              }
              creature={creature}
              health={health.health}
              hunt={hunt}
              isActive={isActive}
              key={creature.id}
              maximumHealth={health.maximumHealth}
              onCommand={onCommand}
            />
          );
        })}
      </div>
      <section className="hunt-status__money" aria-label="Dinheiro atual">
        <span aria-hidden="true">¤</span>
        <strong>{displayedGoldLabel}</strong>
      </section>
    </div>
  );
}

function switchCooldownSeconds(hunt: HuntState | null, now: number): number | null {
  if (!hunt || hunt.activeCreatureSwitchCooldownEndsAt <= now) {
    return null;
  }
  return Math.ceil((hunt.activeCreatureSwitchCooldownEndsAt - now) / 1_000);
}

function HuntPartyCard(props: HuntPartyCardProps): React.ReactElement {
  const { canSwitch, creature, health, hunt, isActive, maximumHealth, onCommand } = props;
  const icon = creatureIconUrl(creature, hunt, isActive);
  const status = statusForCreature(creature, hunt, isActive);
  const elements = status.elements.map(renderElement);
  const healthPercentage = percentage(health, maximumHealth);

  function switchActiveCreature(): void {
    onCommand({ creatureId: creature.id, type: 'switch_active_creature', version: 1 });
  }

  return (
    <section
      aria-label={creature.species.name}
      className={`hunt-status__panel hunt-status__creature hunt-status__creature--party${
        isActive ? ' hunt-status__creature--active' : ''
      }`}
    >
      <button
        aria-label={`Ativar ${creature.species.name}`}
        className="hunt-status__creature-select"
        disabled={!canSwitch}
        onClick={switchActiveCreature}
        type="button"
      >
        <img alt="" className="hunt-status__creature-image" src={icon} />
        <div className="hunt-status__creature-details">
          <strong>{status.name}</strong>
          <span>Nível {status.level}</span>
          <span className="hunt-status__rarity">{rarityLabel(creature.rarity)}</span>
          <HuntStatusBar label="HP" value={healthPercentage} />
          <HuntStatusBar label="EXP" value={status.experiencePercentage} />
          <div className="hunt-status__elements">{elements}</div>
        </div>
      </button>
    </section>
  );
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

function experiencePercentage(currentExperience: string, level: number): number {
  const current = BigInt(currentExperience);
  const start = experienceForLevel(level);
  const next = experienceForLevel(level + 1);
  return experiencePercentageForInterval(current, start, next);
}

function experiencePercentageForInterval(current: bigint, start: bigint, next: bigint): number {
  const interval = next - start;
  if (interval <= 0n) {
    return 100;
  }
  const percentageValue = Number(((current - start) * 10_000n) / interval) / 100;
  return Math.max(0, Math.min(100, percentageValue));
}

function experienceForLevel(level: number): bigint {
  const value = BigInt(level);
  return (50n * value * value * value - 150n * value * value + 400n * value) / 3n;
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
  const reorderedParty = [activeCreature];
  return reorderedParty.concat(remainingParty);
}

function healthForCreature(creature: CollectionCreature, hunt: HuntState | null): CreatureHealth {
  const health = hunt?.partyHealth.find(function findCreatureHealth(candidate): boolean {
    return candidate.creatureId === creature.id;
  });
  if (health) {
    return health;
  }
  const maximumHealth = maximumHealthForCreature(creature);
  return { health: maximumHealth, maximumHealth };
}

function maximumHealthForCreature(creature: CollectionCreature): number {
  const base = creature.species.base_hp;
  return Math.floor(((base * 2 + creature.ivHealth) * creature.level) / 100) + creature.level + 10;
}

function creatureIconUrl(
  creature: CollectionCreature,
  hunt: HuntState | null,
  isActive: boolean,
): string {
  const speciesId = hunt && isActive ? hunt.activeCreatureSpeciesId : creature.species.id;
  return `/assets/creatures/icons/${speciesId ?? creature.species.id}.png`;
}

function statusForCreature(
  creature: CollectionCreature,
  hunt: HuntState | null,
  isActive: boolean,
): CreatureStatus {
  if (hunt && isActive) {
    return {
      elements: hunt.activeCreatureElements,
      experiencePercentage: experiencePercentageForHunt(hunt),
      level: hunt.activeCreatureLevel,
      name: hunt.activeCreatureName,
    };
  }
  return {
    elements: creature.elements,
    experiencePercentage: experiencePercentage(creature.experience, creature.level),
    level: creature.level,
    name: creature.species.name,
  };
}

function experiencePercentageForHunt(hunt: HuntState): number {
  const current = BigInt(hunt.activeCreatureExperience);
  const start = BigInt(hunt.activeCreatureExperienceLevelStart);
  const next = BigInt(hunt.activeCreatureExperienceNextLevel);
  return experiencePercentageForInterval(current, start, next);
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

function profileFromHunt(hunt: HuntState): CharacterProfile {
  return {
    avatarUrl: hunt.characterAvatarUrl,
    gold: hunt.gold,
    level: hunt.characterLevel,
    name: hunt.characterName,
  };
}
