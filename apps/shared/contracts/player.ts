import type { Creature, CreatureAbility } from './creature';
import type { InventoryItem } from './inventory';
import type { CreatureVitals, EquippedAbility, EquippedConsumable, EquippedDevice } from './skill';
import type { Trainer } from './trainer';

export type TeamSlot = {
  slot: number;
  creature: Creature;
};

/**
 * Everything the player sees in the game screen.
 *
 * The team is the creatures that go into battle, at most five, in the order
 * that decides who enters the field. The storage is the captured creatures
 * that are not in the team. The backpack is the items the trainer owns.
 */
export type PlayerState = {
  /**
   * The abilities the species of the active creature has, in the slots the
   * species declares them. This is the list the selection panel shows.
   */
  activeAbilities: CreatureAbility[];
  /** The creature in the field, which is the one in the first team slot. */
  activeCreatureId: string | null;
  /** The life of the active creature. */
  activeVitals: CreatureVitals | null;
  backpack: InventoryItem[];
  diamonds: number;
  /** The abilities equipped in the four ability slots of the active creature. */
  equippedAbilities: EquippedAbility[];
  /** The consumables equipped in the two consumable slots of the trainer. */
  equippedConsumables: EquippedConsumable[];
  /** The capture device equipped in the device slot of the trainer. */
  equippedDevice: EquippedDevice | null;
  /**
   * The identifier of the boot of the server that produced this state.
   *
   * The revision is only comparable inside the same epoch: the server keeps the
   * counter in memory, so a restart resets it. The client compares the pair, and
   * a different epoch means a full resync.
   */
  epoch: string;
  gold: number;
  maxStaminaMinutes: number;
  /**
   * The revision of the state, monotonic inside the epoch.
   *
   * The client applies a state only when its revision is newer, and asks for a
   * resync when it finds a gap.
   */
  rev: number;
  /**
   * The clock of the server when the state was built.
   *
   * The client uses it to correct the drift between its own clock and the
   * server's, so that a countdown derived from a timestamp is right.
   */
  serverNow: number;
  staminaMinutes: number;
  storage: Creature[];
  team: TeamSlot[];
  trainer: Trainer;
};
