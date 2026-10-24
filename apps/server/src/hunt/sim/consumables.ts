import type { SimContent, SimEvent, SimState } from '~/hunt/sim/types';
import { activeCreature, isAlive } from '~/hunt/sim/types';

/**
 * Uses the consumables of the active creature whose trigger was reached.
 *
 * Each slot has its own clock and its own life trigger; the consumable clock
 * never shares the ability interval, so a potion can be used in the same second
 * of an ability.
 */
export function consumeConsumables(
  state: SimState,
  _content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  const active = activeCreature(state);
  if (!isAlive(active) || active.maxHp <= 0) {
    return;
  }
  for (let index = 0; index < active.consumables.length; index += 1) {
    const consumable = active.consumables[index];
    if (consumable === undefined || consumable.quantity <= 0) {
      continue;
    }
    if (now < (active.consumableReadyAt[index] ?? 0)) {
      continue;
    }
    if (active.hp >= active.maxHp) {
      continue;
    }
    if ((active.hp / active.maxHp) * 100 > consumable.triggerHpPercent) {
      continue;
    }
    const heal = Math.round((active.maxHp * consumable.healPercent) / 100);
    const before = active.hp;
    active.hp = Math.min(active.maxHp, active.hp + heal);
    const healed = active.hp - before;
    consumable.quantity -= 1;
    active.consumableReadyAt[index] = now + consumable.cooldownMs;
    events.push(
      { actorId: active.id, amount: healed, at: now, type: 'heal' },
      {
        actorId: active.id,
        at: now,
        itemId: consumable.itemId,
        name: consumable.name,
        quantity: 1,
        type: 'consumable_used',
      },
    );
    addSpent(state, consumable.itemId, consumable.name, 1);
  }
}

/**
 * The public name of the consumable step.
 *
 * The alias keeps the domain verb of the plan without tripping the React hook
 * lint rule, which reads any `use*` call as a hook.
 */
export { consumeConsumables as useConsumables };

function addSpent(state: SimState, itemId: string, name: string, quantity: number): void {
  for (const item of state.ledger.spent) {
    if (item.itemId === itemId) {
      item.quantity += quantity;
      return;
    }
  }
  state.ledger.spent.push({ itemId, name, quantity });
}
