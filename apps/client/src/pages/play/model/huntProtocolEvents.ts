import type { HuntRuntimeEvent } from '@creatures/contracts/huntSim';

import { isElement, isFiniteNumber, isRecord, isTile } from '~/pages/play/model/huntProtocolActors';

type EventValidator = (value: Record<string, unknown>) => boolean;

const EVENT_VALIDATORS: Record<string, EventValidator> = {
  ability_cast: isAbilityCast,
  capture: isCapture,
  consumable_used: isItemEvent,
  damage: isDamage,
  death: isDeath,
  experience: isAmountEvent,
  heal: isAmountEvent,
  level_up: isLevelUp,
  loot: isItemEvent,
  spawn: isSpawn,
  step: isStep,
  target_changed: isTargetChanged,
};

export function readEvents(value: unknown): HuntRuntimeEvent[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const events: HuntRuntimeEvent[] = [];
  for (const event of value) {
    if (!isRuntimeEvent(event)) {
      return null;
    }
    events.push(event);
  }
  return events;
}

function isRuntimeEvent(value: unknown): value is HuntRuntimeEvent {
  if (
    !isRecord(value) ||
    typeof value.actorId !== 'string' ||
    !isFiniteNumber(value.at) ||
    typeof value.type !== 'string'
  ) {
    return false;
  }
  const validator = EVENT_VALIDATORS[value.type];
  return validator === undefined ? false : validator(value);
}

function isAbilityCast(value: Record<string, unknown>): boolean {
  return (
    typeof value.abilitySlug === 'string' &&
    (value.targetTile === undefined || isTile(value.targetTile)) &&
    (value.impactAt === undefined || isFiniteNumber(value.impactAt)) &&
    (value.travelMs === undefined || isFiniteNumber(value.travelMs))
  );
}

function isAmountEvent(value: Record<string, unknown>): boolean {
  return isFiniteNumber(value.amount);
}

function isDamage(value: Record<string, unknown>): boolean {
  return (
    isFiniteNumber(value.amount) && isElement(value.element) && typeof value.targetId === 'string'
  );
}

function isCapture(value: Record<string, unknown>): boolean {
  return (
    typeof value.deviceItemId === 'string' &&
    typeof value.success === 'boolean' &&
    typeof value.speciesSlug === 'string' &&
    (value.potential === undefined || isPotential(value.potential)) &&
    (value.teamSlot === undefined || isFiniteNumber(value.teamSlot))
  );
}

function isDeath(value: Record<string, unknown>): boolean {
  return value.killerId === undefined || typeof value.killerId === 'string';
}

function isLevelUp(value: Record<string, unknown>): boolean {
  return isFiniteNumber(value.level);
}

function isPotential(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isFiniteNumber(value.magicAttack) &&
    isFiniteNumber(value.magicDefense) &&
    isFiniteNumber(value.physicalAttack) &&
    isFiniteNumber(value.physicalDefense) &&
    isFiniteNumber(value.vitality)
  );
}

function isItemEvent(value: Record<string, unknown>): boolean {
  return (
    typeof value.itemId === 'string' &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.quantity)
  );
}

function isSpawn(value: Record<string, unknown>): boolean {
  return isFiniteNumber(value.spawnIndex) && typeof value.speciesSlug === 'string';
}

function isStep(value: Record<string, unknown>): boolean {
  return isTile(value.from) && isTile(value.to);
}

function isTargetChanged(value: Record<string, unknown>): boolean {
  return value.targetId === null || typeof value.targetId === 'string';
}
