import { expect, test } from 'bun:test';

import type { Creature, CreatureAbility } from '@creatures/contracts/creature';
import type { InventoryItem } from '@creatures/contracts/inventory';
import type { TeamSlot } from '@creatures/contracts/player';
import type {
  EquippedAbility,
  EquippedConsumable,
  EquippedDevice,
} from '@creatures/contracts/skill';
import type { Trainer } from '@creatures/contracts/trainer';

import { buildPlayerState, MAX_STAMINA_MINUTES } from '~/state/playerState';
import type { StateRevision } from '~/state/playerState';

const REVISION: StateRevision = { epoch: 'epoch-of-the-test', rev: 7 };
const SERVER_NOW = 1_700_000_000_000;

const TRAINER: Trainer = {
  createdAt: '2026-01-01T00:00:00.000Z',
  diamonds: 12,
  gender: 'male',
  gold: 340,
  id: '11111111-1111-4111-8111-111111111111',
  level: 2,
  name: 'Beto',
  staminaMinutes: 480,
  starterSpeciesId: '33333333-3333-4333-8333-333333333333',
};

const CREATURE: Creature = {
  capturedAt: '2026-01-02T00:00:00.000Z',
  createdAt: '2026-01-02T00:00:00.000Z',
  experience: 0,
  id: '44444444-4444-4444-8444-444444444444',
  isInTeam: true,
  level: 1,
  nickname: 'Beto',
  potential: {
    magicAttack: 50,
    magicDefense: 50,
    physicalAttack: 50,
    physicalDefense: 50,
    vitality: 50,
  },
  species: {
    element: 'fire',
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Brasa',
    slug: 'brasa',
  },
  speciesId: '33333333-3333-4333-8333-333333333333',
  teamSlot: 1,
  trainerId: TRAINER.id,
};

const ABILITY: CreatureAbility = {
  abilityId: '55555555-5555-4555-8555-555555555555',
  cooldownMs: 4000,
  damage: 12,
  element: 'fire',
  name: 'Brasa',
  slot: 0,
  slug: 'brasa',
};

const EQUIPPED_ABILITY: EquippedAbility = {
  abilityId: ABILITY.abilityId,
  cooldownMs: ABILITY.cooldownMs,
  damage: ABILITY.damage,
  element: ABILITY.element,
  name: ABILITY.name,
  slot: 0,
  slug: ABILITY.slug,
};

const CONSUMABLE: EquippedConsumable = {
  itemId: '99999999-9999-4999-8999-999999999999',
  name: 'Poção de Cura',
  quantity: 2,
  slot: 4,
  triggerHpPercent: 30,
};

const DEVICE: EquippedDevice = {
  itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Prisma Simples',
  quantity: 1,
  slot: 6,
};

const BACKPACK_ITEM: InventoryItem = {
  category: 'material',
  description: 'Pata de uma criatura derrotada.',
  itemId: '66666666-6666-4666-8666-666666666666',
  name: 'Pata de Criatura',
  quantity: 3,
  slug: 'pata-de-criatura',
};

function buildsStateFromTrainerAndTeam(): void {
  const state = buildPlayerState(
    {
      activeAbilities: [],
      activeVitals: null,
      backpack: [],
      equippedAbilities: [],
      equippedConsumables: [],
      equippedDevice: null,
      storage: [],
      team: [],
      trainer: TRAINER,
    },
    REVISION,
    SERVER_NOW,
  );
  expect(state.trainer).toBe(TRAINER);
  expect(state.team).toEqual([]);
  expect(state.gold).toBe(340);
  expect(state.diamonds).toBe(12);
  expect(state.staminaMinutes).toBe(480);
  expect(state.maxStaminaMinutes).toBe(MAX_STAMINA_MINUTES);
  expect(state.maxStaminaMinutes).toBe(720);
  expect(state.rev).toBe(7);
  expect(state.epoch).toBe('epoch-of-the-test');
  expect(state.serverNow).toBe(SERVER_NOW);
}

/**
 * The state carries the revision of the account, so the client knows whether
 * it is newer than the one it has.
 */
function carriesTheRevisionOfTheAccount(): void {
  const state = buildPlayerState(
    {
      activeAbilities: [],
      activeVitals: null,
      backpack: [],
      equippedAbilities: [],
      equippedConsumables: [],
      equippedDevice: null,
      storage: [],
      team: [],
      trainer: TRAINER,
    },
    { epoch: 'another-epoch', rev: 42 },
    SERVER_NOW,
  );
  expect(state.rev).toBe(42);
  expect(state.epoch).toBe('another-epoch');
}

function buildsStateWithMissingWalletValues(): void {
  const trainer: Trainer = { ...TRAINER };
  delete trainer.gold;
  delete trainer.diamonds;
  delete trainer.staminaMinutes;
  const state = buildPlayerState(
    {
      activeAbilities: [],
      activeVitals: null,
      backpack: [],
      equippedAbilities: [],
      equippedConsumables: [],
      equippedDevice: null,
      storage: [],
      team: [],
      trainer,
    },
    REVISION,
    SERVER_NOW,
  );
  expect(state.gold).toBe(0);
  expect(state.diamonds).toBe(0);
  expect(state.staminaMinutes).toBe(MAX_STAMINA_MINUTES);
}

function buildsStateWithTheWholeCollection(): void {
  const team: TeamSlot[] = [{ creature: CREATURE, slot: 1 }];
  const storage: Creature[] = [{ ...CREATURE, id: '77777777-7777-4777-8777-777777777777' }];
  const state = buildPlayerState(
    {
      activeAbilities: [ABILITY],
      activeVitals: { currentHp: 12, maxHp: 22 },
      backpack: [BACKPACK_ITEM],
      equippedAbilities: [EQUIPPED_ABILITY],
      equippedConsumables: [CONSUMABLE],
      equippedDevice: DEVICE,
      storage,
      team,
      trainer: TRAINER,
    },
    REVISION,
    SERVER_NOW,
  );
  expect(state.team).toEqual(team);
  expect(state.storage).toEqual(storage);
  expect(state.backpack).toEqual([BACKPACK_ITEM]);
  expect(state.activeAbilities).toEqual([ABILITY]);
}

function carriesTheLoadoutAndTheLife(): void {
  const state = buildPlayerState(
    {
      activeAbilities: [ABILITY],
      activeVitals: { currentHp: 12, maxHp: 22 },
      backpack: [],
      equippedAbilities: [EQUIPPED_ABILITY],
      equippedConsumables: [CONSUMABLE],
      equippedDevice: DEVICE,
      storage: [],
      team: [{ creature: CREATURE, slot: 1 }],
      trainer: TRAINER,
    },
    REVISION,
    SERVER_NOW,
  );
  expect(state.equippedAbilities).toEqual([EQUIPPED_ABILITY]);
  expect(state.equippedConsumables).toEqual([CONSUMABLE]);
  expect(state.equippedDevice).toEqual(DEVICE);
  expect(state.activeVitals).toEqual({ currentHp: 12, maxHp: 22 });
}

function namesTheCreatureInTheField(): void {
  const first: TeamSlot = { creature: CREATURE, slot: 1 };
  const second: TeamSlot = {
    creature: { ...CREATURE, id: '88888888-8888-4888-8888-888888888888' },
    slot: 2,
  };
  const state = buildPlayerState(
    {
      activeAbilities: [],
      activeVitals: null,
      backpack: [],
      equippedAbilities: [],
      equippedConsumables: [],
      equippedDevice: null,
      storage: [],
      team: [first, second],
      trainer: TRAINER,
    },
    REVISION,
    SERVER_NOW,
  );
  expect(state.activeCreatureId).toBe(CREATURE.id);
}

function hasNoCreatureInTheFieldWithoutATeam(): void {
  const state = buildPlayerState(
    {
      activeAbilities: [],
      activeVitals: null,
      backpack: [],
      equippedAbilities: [],
      equippedConsumables: [],
      equippedDevice: null,
      storage: [],
      team: [],
      trainer: TRAINER,
    },
    REVISION,
    SERVER_NOW,
  );
  expect(state.activeCreatureId).toBeNull();
  expect(state.activeVitals).toBeNull();
}

test('buildPlayerState copies the trainer wallet and stamina', buildsStateFromTrainerAndTeam);
test('buildPlayerState carries the revision of the account', carriesTheRevisionOfTheAccount);
test('buildPlayerState defaults missing wallet values', buildsStateWithMissingWalletValues);
test(
  'buildPlayerState carries the team, the storage and the backpack',
  buildsStateWithTheWholeCollection,
);
test(
  'buildPlayerState carries the loadout and the life of the creature',
  carriesTheLoadoutAndTheLife,
);
test('buildPlayerState names the creature of the first slot', namesTheCreatureInTheField);
test('buildPlayerState has no active creature without a team', hasNoCreatureInTheFieldWithoutATeam);
