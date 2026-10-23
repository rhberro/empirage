/* eslint-disable max-lines */
import type { CreatureAbility } from '@creatures/contracts/creature';
import type { InventoryItem } from '@creatures/contracts/inventory';
import type { PlayerState } from '@creatures/contracts/player';
import type { SkillSlot } from '@creatures/contracts/skill';
import { ABILITY_SLOTS, CONSUMABLE_SLOTS, DEVICE_SLOT } from '@creatures/contracts/skill';

import type { CatalogItem } from './catalog';
import { CONSUMABLE_CATALOG, DEVICE_CATALOG } from './catalog';
import type { PanelCardEntry, SkillSlotKind } from './skillPanel.types';

/**
 * An item of the catalog with the quantity the trainer owns of it.
 */
type OwnedCatalogItem = CatalogItem & { quantity: number };

/**
 * The group of a slot of the skill bar.
 *
 * The four first slots hold the abilities of the active creature, the next two
 * hold the consumables of the trainer, and the last one holds the capture
 * device.
 */
export function readSlotKind(slot: SkillSlot): SkillSlotKind {
  if (ABILITY_SLOTS.includes(slot)) {
    return 'ability';
  }
  if (CONSUMABLE_SLOTS.includes(slot)) {
    return 'consumable';
  }
  return 'device';
}

export function isAbilitySlot(slot: SkillSlot): boolean {
  return readSlotKind(slot) === 'ability';
}

export function isConsumableSlot(slot: SkillSlot): boolean {
  return readSlotKind(slot) === 'consumable';
}

export function isDeviceSlot(slot: SkillSlot): boolean {
  return slot === DEVICE_SLOT;
}

/**
 * The abilities the player can choose for a slot of the active creature.
 *
 * The list is the one of the species of the active creature. An ability that
 * is equipped in another slot does not show up: the same ability cannot be in
 * two slots at the same time.
 */
export function buildAbilityEntries(
  state: PlayerState | null,
  targetSlot: SkillSlot,
): PanelCardEntry[] {
  const equipped = state?.equippedAbilities ?? [];
  const selectedId = readEquippedAbilityId(equipped, targetSlot);
  const takenIds = equipped.map(readEquippedAbilityIdValue);
  const abilities = state?.activeAbilities ?? [];
  return abilities
    .filter(buildAbilityFilter(takenIds, selectedId))
    .map(buildAbilityMapper(selectedId, state));
}

function buildAbilityFilter(
  takenIds: string[],
  selectedId: string | null,
): (ability: CreatureAbility) => boolean {
  return function isSelectable(ability: CreatureAbility): boolean {
    if (ability.abilityId === selectedId) {
      return true;
    }
    return !takenIds.includes(ability.abilityId);
  };
}

function buildAbilityMapper(
  selectedId: string | null,
  state: PlayerState | null,
): (ability: CreatureAbility) => PanelCardEntry {
  return function toEntry(ability: CreatureAbility): PanelCardEntry {
    const requirement = readMinimumLevel(ability);
    const level = readCreatureLevel(state);
    const unavailable = requirement !== null && level < requirement;
    const description =
      ability.description !== undefined && ability.description.trim() !== ''
        ? ability.description
        : `${ability.element} · ${ability.damage} de dano`;
    return {
      cooldownMs: ability.cooldownMs,
      damage: ability.damage,
      description,
      disabled: unavailable,
      element: ability.element,
      id: ability.abilityId,
      kind: 'ability',
      name: ability.name,
      note: readAbilityNote(ability, requirement, unavailable),
      selected: ability.abilityId === selectedId,
    };
  };
}

/**
 * The note of an ability: the warning of the level, or the time of reload.
 *
 * The minimum level is a rule of the species that the catalog does not carry
 * yet: without it, no ability is out of reach, and the note is the reload.
 */
function readAbilityNote(
  ability: CreatureAbility,
  requirement: number | null,
  unavailable: boolean,
): string {
  if (unavailable && requirement !== null) {
    return `Nível mínimo de ${requirement} não alcançado`;
  }
  return `Recarga ${Math.round(ability.cooldownMs / 1000)}s`;
}

/**
 * The level a creature needs to use an ability.
 *
 * The field is read when the catalog carries it: without it there is no level
 * that blocks an ability, and the interface does not invent one.
 */
function readMinimumLevel(ability: CreatureAbility): number | null {
  const level = (ability as { minimumLevel?: unknown }).minimumLevel;
  return typeof level === 'number' ? level : null;
}

function readCreatureLevel(state: PlayerState | null): number {
  if (state === null) {
    return 0;
  }
  const activeId = state.activeCreatureId;
  if (activeId === null) {
    return 0;
  }
  const team = state.team ?? [];
  const active = team.find(matchesCreatureId(activeId));
  return active?.creature.level ?? 0;
}

function matchesCreatureId(activeId: string): (entry: { creature: { id: string } }) => boolean {
  return function matches(entry): boolean {
    return entry.creature.id === activeId;
  };
}

/**
 * The consumables the player can choose for a slot.
 *
 * The list is the whole catalog, not only the backpack: the quantity in the
 * backpack is what changes the interaction, not what shows up.
 */
export function buildConsumableEntries(
  state: PlayerState | null,
  targetSlot: SkillSlot,
): PanelCardEntry[] {
  const items = mergeCatalogWithBackpack(CONSUMABLE_CATALOG, state?.backpack, 'consumable');
  const selectedId = readEquippedConsumableId(state, targetSlot);
  const entries = items.map(buildConsumableMapper(selectedId));
  return sortByStrength(entries);
}

/**
 * The capture devices the player can choose for the device slot.
 */
export function buildDeviceEntries(state: PlayerState | null): PanelCardEntry[] {
  const items = mergeCatalogWithBackpack(DEVICE_CATALOG, state?.backpack, 'device');
  const selectedId = state?.equippedDevice?.itemId ?? null;
  const entries = items.map(buildDeviceMapper(selectedId));
  return sortByStrength(entries);
}

function buildConsumableMapper(
  selectedId: string | null,
): (item: OwnedCatalogItem) => PanelCardEntry {
  return function toEntry(item: OwnedCatalogItem): PanelCardEntry {
    return buildGearEntry(item, 'consumable', item.quantity > 0, item.itemId === selectedId);
  };
}

function buildDeviceMapper(selectedId: string | null): (item: OwnedCatalogItem) => PanelCardEntry {
  return function toEntry(item: OwnedCatalogItem): PanelCardEntry {
    return buildGearEntry(item, 'device', item.quantity > 0, item.itemId === selectedId);
  };
}

function buildGearEntry(
  item: OwnedCatalogItem,
  kind: 'consumable' | 'device',
  hasQuantity: boolean,
  selected: boolean,
): PanelCardEntry {
  return {
    description: item.description,
    disabled: !hasQuantity,
    id: item.itemId,
    kind,
    name: item.name,
    note: `Na mochila: ${item.quantity}`,
    selected,
  };
}

/**
 * The catalog of the game joined with the backpack of the trainer.
 *
 * An item that the trainer owns and that the catalog does not know still
 * shows up: the backpack is the truth about what exists in the account.
 */
function mergeCatalogWithBackpack(
  catalog: CatalogItem[],
  backpack: InventoryItem[] | undefined,
  category: 'consumable' | 'device',
): OwnedCatalogItem[] {
  const items: OwnedCatalogItem[] = catalog.map(buildOwnedCatalogItem);
  for (const owned of backpack ?? []) {
    if (owned.category !== category) {
      continue;
    }
    const known = items.find(matchesItemId(owned.itemId));
    if (known !== undefined) {
      known.quantity = owned.quantity;
      continue;
    }
    items.push(buildBackpackItem(owned));
  }
  return items;
}

function buildOwnedCatalogItem(item: CatalogItem): OwnedCatalogItem {
  return { ...item, quantity: 0 };
}

function buildBackpackItem(owned: InventoryItem): OwnedCatalogItem {
  return {
    description: owned.description,
    itemId: owned.itemId,
    name: owned.name,
    quantity: owned.quantity,
    rank: 0,
  };
}

function matchesItemId(itemId: string): (item: { itemId: string }) => boolean {
  return function matches(item): boolean {
    return item.itemId === itemId;
  };
}

/**
 * The strongest item on top.
 *
 * The order is the information: the player sees the line of evolution of the
 * items even without owning the best ones.
 */
function sortByStrength(entries: PanelCardEntry[]): PanelCardEntry[] {
  // The client targets es2022, where `toSorted` is not in the standard library.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...entries].sort(compareStrength);
}

function compareStrength(left: PanelCardEntry, right: PanelCardEntry): number {
  const difference = readStrength(right) - readStrength(left);
  if (difference !== 0) {
    return difference;
  }
  return left.name.localeCompare(right.name);
}

function readStrength(entry: PanelCardEntry): number {
  const items = [...CONSUMABLE_CATALOG, ...DEVICE_CATALOG];
  const found = items.find(matchesItemId(entry.id));
  return found?.rank ?? 0;
}

function readEquippedAbilityId(
  equipped: { abilityId: string; slot: SkillSlot }[],
  targetSlot: SkillSlot,
): string | null {
  const found = equipped.find(matchesSlot(targetSlot));
  return found?.abilityId ?? null;
}

function matchesSlot(targetSlot: SkillSlot): (entry: { slot: SkillSlot }) => boolean {
  return function matches(entry): boolean {
    return entry.slot === targetSlot;
  };
}

function readEquippedAbilityIdValue(entry: { abilityId: string }): string {
  return entry.abilityId;
}

function readEquippedConsumableId(state: PlayerState | null, targetSlot: SkillSlot): string | null {
  const equipped = state?.equippedConsumables ?? [];
  const found = equipped.find(matchesSlot(targetSlot));
  return found?.itemId ?? null;
}
