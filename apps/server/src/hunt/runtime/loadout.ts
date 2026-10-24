import { loadHuntTeam } from '~/hunt/content';
import type { SimAbility, SimConsumable, SimTeamMember, SimTeamMemberInput } from '~/hunt/sim';
import type { HuntTeamLoad } from '~/hunt/teamMappers';

import type { HuntManagerState } from './state';
import type { HuntManager, HuntRuntime } from './types';
import { toDelta } from './wire';

const ABILITY_SLOT_COUNT = 4;

/**
 * Refreshes the loadout of the creatures of a running hunt.
 *
 * The hunt begins with a snapshot of the team, and the player keeps editing the
 * ability slots and the gear during the fight. The refresh reads the team again
 * and replaces only what the player can edit: the life, the level, the position,
 * the experience, the target and the behavior stay as the simulation left them.
 *
 * Serialized with the other operations of the trainer, so it never replaces the
 * loadout while an advance is reading it.
 */
export function buildRefreshLoadout(state: HuntManagerState): HuntManager['refreshLoadout'] {
  return function refreshLoadout(trainerId: string): Promise<void> {
    return state.enqueue(trainerId, function refreshTask(): Promise<void> {
      return refreshNow(state, trainerId);
    });
  };
}

function refreshNow(state: HuntManagerState, trainerId: string): Promise<void> {
  const runtime = state.runtimes.get(trainerId);
  if (runtime === undefined) {
    return Promise.resolve();
  }
  return loadHuntTeam(state.admin, trainerId).then(function apply(teamLoad: HuntTeamLoad): void {
    const at = state.now();
    applyDevice(runtime, teamLoad);
    for (const member of runtime.state.team) {
      const input = findMember(teamLoad.team, member.creatureId);
      if (input === undefined) {
        continue;
      }
      applyAbilities(member, input.abilities, at);
      applyConsumables(member, input.consumables, at);
    }
    runtime.dirty = true;
    runtime.huntRev += 1;
    state.deps.onDelta?.(runtime.accountId, trainerId, toDelta(runtime, [], [], at));
    state.scheduler?.arm(trainerId);
  });
}

/**
 * Replaces the equipped device, keeping the quantity the simulation already
 * consumed.
 *
 * The backpack write of a capture attempt travels in the background, so the
 * row can still hold the old quantity when the loadout is refreshed. A device
 * of the same item keeps the local count; a new device starts from the
 * backpack.
 */
function applyDevice(runtime: HuntRuntime, teamLoad: HuntTeamLoad): void {
  const next = teamLoad.device;
  if (next === null) {
    runtime.state.device = null;
    return;
  }
  const current = runtime.state.device;
  if (current !== null && current.itemId === next.itemId) {
    runtime.state.device = { ...next, quantity: current.quantity };
    return;
  }
  runtime.state.device = { ...next };
}

function findMember(
  team: SimTeamMemberInput[],
  creatureId: string,
): SimTeamMemberInput | undefined {
  return team.find(function matches(member: SimTeamMemberInput): boolean {
    return member.creatureId === creatureId;
  });
}

/**
 * The four ability slots, by position.
 *
 * The ability that stays in the slot keeps its cooldown; the one that enters,
 * whether it is new or replaced another, is born in cooldown. An empty slot has
 * no cooldown at all.
 */
function applyAbilities(member: SimTeamMember, abilities: (SimAbility | null)[], at: number): void {
  const next: (SimAbility | null)[] = [];
  const readyAt: (number | null)[] = [];
  for (let slot = 0; slot < ABILITY_SLOT_COUNT; slot += 1) {
    const ability = abilities[slot] ?? null;
    next.push(ability);
    readyAt.push(readAbilityReadyAt(member, slot, ability, at));
  }
  member.abilities = next;
  member.abilityReadyAt = readyAt;
}

function readAbilityReadyAt(
  member: SimTeamMember,
  slot: number,
  ability: SimAbility | null,
  at: number,
): number | null {
  if (ability === null) {
    return null;
  }
  const previous = member.abilities[slot] ?? null;
  if (previous !== null && previous.slug === ability.slug) {
    return member.abilityReadyAt[slot] ?? null;
  }
  return at + ability.cooldownMs;
}

/**
 * The consumables of the trainer, by gear slot.
 *
 * A slot that keeps the same item keeps its cooldown, whichever field of the
 * item changed; a slot with another item (or a new one) is born in cooldown. A
 * slot that is not in the new load disappears with its cooldown.
 */
function applyConsumables(member: SimTeamMember, consumables: SimConsumable[], at: number): void {
  const next: SimConsumable[] = [];
  const readyAt: number[] = [];
  for (const consumable of consumables) {
    const previousIndex = readConsumableIndex(member.consumables, consumable.slot);
    next.push({ ...consumable });
    if (previousIndex !== -1 && member.consumables[previousIndex]?.itemId === consumable.itemId) {
      readyAt.push(member.consumableReadyAt[previousIndex] ?? 0);
      continue;
    }
    readyAt.push(at + consumable.cooldownMs);
  }
  member.consumables = next;
  member.consumableReadyAt = readyAt;
}

function readConsumableIndex(consumables: SimConsumable[], slot: number): number {
  return consumables.findIndex(function matches(consumable: SimConsumable): boolean {
    return consumable.slot === slot;
  });
}
