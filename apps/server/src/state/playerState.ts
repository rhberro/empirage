import type { Creature, CreatureAbility } from '@creatures/contracts/creature';
import type { InventoryItem } from '@creatures/contracts/inventory';
import type { PlayerState, TeamSlot } from '@creatures/contracts/player';
import type {
  CreatureVitals,
  EquippedAbility,
  EquippedConsumable,
  EquippedDevice,
} from '@creatures/contracts/skill';
import type { Trainer } from '@creatures/contracts/trainer';
import type { SupabaseClient } from '@supabase/supabase-js';

import { listEquippedAbilities, readTrainerGear } from '~/db/loadoutRepository';
import type { TrainerGear } from '~/db/loadoutRepository';
import {
  listBackpackItems,
  listSpeciesAbilities,
  listStorageCreatures,
  listTeamCreatures,
  readActiveVitals,
} from '~/db/playerRepository';
import { findTrainerById } from '~/db/trainerRepository';

/** The stamina cap is the same for every trainer: 12 hours. */
export const MAX_STAMINA_MINUTES = 720;

export type PlayerStateParts = {
  activeAbilities: CreatureAbility[];
  activeVitals: CreatureVitals | null;
  backpack: InventoryItem[];
  equippedAbilities: EquippedAbility[];
  equippedConsumables: EquippedConsumable[];
  equippedDevice: EquippedDevice | null;
  storage: Creature[];
  team: TeamSlot[];
  trainer: Trainer;
};

type TeamCollections = {
  backpack: InventoryItem[];
  storage: Creature[];
  team: TeamSlot[];
};

/**
 * Where the state of the account is in the sequence of its revisions.
 *
 * The revision only means something inside the epoch of the process, so the
 * two travel together.
 */
export type StateRevision = {
  /** The identifier of the boot of the server that produced the state. */
  epoch: string;
  /** The revision of the state, monotonic inside the epoch. */
  rev: number;
};

/**
 * The whole state the game screen reads.
 *
 * The creature in the field is the one in the first slot of the team: the
 * order of the team is what decides who enters the field.
 */
export function buildPlayerState(
  parts: PlayerStateParts,
  revision: StateRevision,
  serverNow: number = Date.now(),
): PlayerState {
  const {
    activeAbilities,
    activeVitals,
    backpack,
    equippedAbilities,
    equippedConsumables,
    equippedDevice,
    storage,
    team,
    trainer,
  } = parts;
  const active = team[0];
  return {
    activeAbilities,
    activeCreatureId: active === undefined ? null : active.creature.id,
    activeVitals,
    backpack,
    diamonds: trainer.diamonds ?? 0,
    epoch: revision.epoch,
    equippedAbilities,
    equippedConsumables,
    equippedDevice,
    gold: trainer.gold ?? 0,
    maxStaminaMinutes: MAX_STAMINA_MINUTES,
    rev: revision.rev,
    serverNow,
    staminaMinutes: trainer.staminaMinutes ?? MAX_STAMINA_MINUTES,
    storage,
    team,
    trainer,
  };
}

/**
 * Loads the state of a trainer that belongs to the account, so the ownership
 * check and the state snapshot are always read from the same source.
 */
export function loadPlayerState(
  admin: SupabaseClient,
  trainerId: string,
  ownerId: string,
  revision: StateRevision,
): Promise<PlayerState | null> {
  return findTrainerById(admin, trainerId, ownerId).then(readPlayerParts(admin, revision));
}

function readPlayerParts(
  admin: SupabaseClient,
  revision: StateRevision,
): (trainer: Trainer | null) => Promise<PlayerState | null> {
  return function buildParts(trainer: Trainer | null): Promise<PlayerState | null> {
    if (trainer === null) {
      return Promise.resolve(null);
    }
    return readTeamCollections(admin, trainer.id).then(function withCollections(
      collections: TeamCollections,
    ): Promise<PlayerState> {
      const active = collections.team[0];
      if (active === undefined) {
        return readTrainerGear(admin, trainer.id).then(function withGear(
          gear: TrainerGear,
        ): PlayerState {
          return buildState(trainer, collections, [[], [], null, gear], revision);
        });
      }
      return Promise.all([
        listSpeciesAbilities(admin, active.creature.speciesId),
        listEquippedAbilities(admin, active.creature.id),
        readActiveVitals(admin, trainer.id),
        readTrainerGear(admin, trainer.id),
      ]).then(function withLoadout(reads: LoadoutReads): PlayerState {
        return buildState(trainer, collections, reads, revision);
      });
    });
  };
}

/**
 * The state of the trainer, with what the loadout and the collections say.
 */
function buildState(
  trainer: Trainer,
  collections: TeamCollections,
  loadout: LoadoutReads,
  revision: StateRevision,
): PlayerState {
  const [activeAbilities, equippedAbilities, activeVitals, gear] = loadout;
  return buildPlayerState(
    {
      activeAbilities,
      activeVitals,
      backpack: collections.backpack,
      equippedAbilities,
      equippedConsumables: gear.consumables,
      equippedDevice: gear.device,
      storage: collections.storage,
      team: collections.team,
      trainer,
    },
    revision,
  );
}

type LoadoutReads = [CreatureAbility[], EquippedAbility[], CreatureVitals | null, TrainerGear];

function readTeamCollections(admin: SupabaseClient, trainerId: string): Promise<TeamCollections> {
  return Promise.all([
    listTeamCreatures(admin, trainerId),
    listStorageCreatures(admin, trainerId),
    listBackpackItems(admin, trainerId),
  ]).then(function buildCollections(
    reads: [TeamSlot[], Creature[], InventoryItem[]],
  ): TeamCollections {
    const [team, storage, backpack] = reads;
    return { backpack, storage, team };
  });
}
