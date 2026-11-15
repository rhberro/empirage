import { Button, HStack } from '@chakra-ui/react';
/* eslint-disable react/no-multi-comp, react/forbid-component-props, oxc/no-optional-chaining, oxsome/no-jsx-inline-computation, oxsome/no-inline-functions-objects-arrays */
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
  isActive: boolean;
  canRemove: boolean;
  onCommand: (command: HuntCommand) => boolean;
};
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
  const activeCreature = hunt
    ? collectionCreatureFor(hunt.activeCreatureId, collection)
    : undefined;
  const party = collection?.party ?? [];
  return (
    <div className="hunt-status">
      <section className="hunt-status__panel hunt-status__trainer" aria-label="Treinador atual">
        <div className="hunt-status__avatar">{trainerAvatar}</div>
        <div>
          <strong>{status.name}</strong>
          <span>Nível {status.level}</span>
        </div>
      </section>
      <HStack className="hunt-status__party" gap="2">
        {party.map(function renderPartyCard(creature): React.ReactElement {
          return (
            <HuntPartyCard
              canRemove={creature.id !== activeCreatureId}
              canSwitch={
                creature.id !== activeCreatureId &&
                (!hunt ||
                  (now >= hunt.activeCreatureSwitchCooldownEndsAt &&
                    hunt.activeCreatureSwitchCompletesAt === undefined))
              }
              creature={creature}
              isActive={creature.id === activeCreatureId}
              key={creature.id}
              onCommand={onCommand}
            />
          );
        })}
      </HStack>
      {hunt ? <ActiveCreatureCard creature={activeCreature} hunt={hunt} /> : null}
      <section className="hunt-status__money" aria-label="Dinheiro atual">
        <span aria-hidden="true">¤</span>
        <strong>{displayedGoldLabel}</strong>
      </section>
    </div>
  );
}

function HuntPartyCard(props: HuntPartyCardProps): React.ReactElement {
  const { canRemove, canSwitch, creature, isActive, onCommand } = props;
  const icon = `/assets/creatures/icons/${creature.species.id}.png`;

  function removeFromParty(): void {
    onCommand({ creatureId: creature.id, type: 'move_creature_to_storage', version: 1 });
  }

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
          <strong>{creature.species.name}</strong>
          <span>Nível {creature.level}</span>
        </div>
      </button>
      {canRemove ? (
        <Button
          aria-label={`Remover ${creature.species.name} do time`}
          minW="0"
          onClick={removeFromParty}
          position="absolute"
          right="0"
          size="2xs"
          top="0"
          variant="ghost"
          zIndex="1"
        >
          ×
        </Button>
      ) : null}
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

type ActiveCreatureCardProps = {
  creature: CollectionCreature | undefined;
  hunt: HuntState;
};

function ActiveCreatureCard(props: ActiveCreatureCardProps): React.ReactElement {
  const { creature, hunt } = props;
  const creatureImageUrl = `/assets/creatures/icons/${hunt.activeCreatureSpeciesId}.png`;
  const healthPercentage = percentage(hunt.activeCreatureHealth, hunt.activeCreatureMaximumHealth);
  const experiencePercentage = experiencePercentageFor(hunt);
  const elements = hunt.activeCreatureElements.map(renderElement);
  const rarity = creature ? (
    <span className="hunt-status__rarity">{rarityLabel(rarityForCreature(creature))}</span>
  ) : null;
  return (
    <section className="hunt-status__panel hunt-status__creature" aria-label="Criatura atual">
      <img alt="" className="hunt-status__creature-image" src={creatureImageUrl} />
      <div className="hunt-status__creature-details">
        <strong>{hunt.activeCreatureName}</strong>
        <span>Nível {hunt.activeCreatureLevel}</span>
        {rarity}
        <HuntStatusBar label="EXP" value={experiencePercentage} />
        <HuntStatusBar label="HP" value={healthPercentage} />
        <div className="hunt-status__elements">{elements}</div>
      </div>
    </section>
  );
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

function experiencePercentageFor(hunt: HuntState): number {
  const current = BigInt(hunt.activeCreatureExperience);
  const start = BigInt(hunt.activeCreatureExperienceLevelStart);
  const next = BigInt(hunt.activeCreatureExperienceNextLevel);
  const interval = next - start;
  if (interval <= 0n) {
    return 100;
  }
  const percentageValue = Number(((current - start) * 10_000n) / interval) / 100;
  return Math.max(0, Math.min(100, percentageValue));
}

function collectionCreatureFor(
  creatureId: string,
  collection: CollectionStateEvent['collection'] | null,
): CollectionCreature | undefined {
  return collection?.party.find(function findCreature(creature): boolean {
    return creature.id === creatureId;
  });
}

function rarityForCreature(creature: CollectionCreature): string {
  const total =
    creature.ivHealth +
    creature.ivAttack +
    creature.ivDefense +
    creature.ivSpecialAttack +
    creature.ivSpecialDefense +
    creature.ivSpeed;
  if (total <= 37) {
    return 'common';
  }
  if (total <= 74) {
    return 'uncommon';
  }
  if (total <= 111) {
    return 'rare';
  }
  return total <= 148 ? 'epic' : 'legendary';
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
