/* eslint-disable complexity, max-lines, max-lines-per-function, no-shadow, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types, unicorn/no-array-reduce, unicorn/no-immediate-mutation, unicorn/no-useless-undefined */
import { randomUUID } from 'node:crypto';

import type { CaptureRarity } from './capture-items.ts';
import type { Movement, Position } from './game-types.ts';
import type {
  HuntAbilityResource,
  HuntCreatureResource,
  HuntResources,
  HuntSpeciesResource,
} from './hunt-resources.ts';

const ALLY_POSITION: Position = { x: 6, y: 3 };
const PLAYER_POSITION: Position = { x: 2, y: 3 };
const GRID_HEIGHT = 8;
const GRID_WIDTH = 12;
const MOVEMENT_MS = 694;
const ABILITY_SPACING_MS = 1_000;
const ENEMY_SPACING_MS = 150;
const GLOBAL_COOLDOWN_KEY = 'global';
const HEALING_ITEM_COOLDOWN_ACTOR = 'healing-item';
const ADJACENT_WANDER_MINIMUM_MS = 2_500;
const ADJACENT_WANDER_MAXIMUM_MS = 4_500;
const ACTIVE_CREATURE_SWITCH_MS = 1_000;
const ACTIVE_CREATURE_ARRIVAL_MS = 320;
const ACTIVE_CREATURE_SWITCH_COOLDOWN_MS = 7_000;

export type HuntCombatEvent = {
  abilityName: string;
  damages: Array<{ amount: number; tile: Position }>;
  element: string;
  from: Position;
  id: string;
  kind: 'area' | 'melee' | 'ranged';
  occurredAt: number;
  tiles: Array<Position>;
  to: Position;
};
export type HuntEngineEnemy = HuntSpeciesResource & {
  combatId: string;
  health: number;
  level: number;
  maximumHealth: number;
  movement?: Movement;
  nextAttackAt: number;
  nextMovementAt?: number;
  position: Position;
  rarity: CaptureRarity;
};
export type HuntEngineAlly = HuntCreatureResource & {
  health: number;
  maximumHealth: number;
};
export type HuntEngineCheckpoint = {
  activeCreatureAvailableAt?: number;
  activeCreatureSwitchCompletesAt?: number;
  activeCreatureSwitchCooldownEndsAt?: number;
  activeCreatureSwitchTargetId?: string;
  abilityCooldowns?: Record<string, Record<string, number>>;
  activeCreatureId: string;
  activeCreatureHealth: number;
  capturedAt: number;
  enemyActionNotBefore?: number;
  enemies: Array<HuntEngineEnemy>;
  huntId: string;
  nextEventAt: number;
  pausedAt?: number;
  playerPosition: Position;
  revision: number;
  wave: number;
  waveDelayMs: number;
  waveSize: number;
  xpPending?: Record<string, number>;
};
export type HuntEngine = {
  activeCreatureAvailableAt: number;
  abilityCooldowns: Record<string, Record<string, number>>;
  activeAllyIndex: number;
  activeCreatureSwitchCompletesAt?: number;
  activeCreatureSwitchCooldownEndsAt: number;
  activeCreatureSwitchTargetId?: string;
  allies: Array<HuntEngineAlly>;
  enemies: Array<HuntEngineEnemy>;
  enemyActionNotBefore: number;
  finished: boolean;
  huntId: string;
  nextEventAt: number;
  pausedAt?: number;
  playerPosition: Position;
  resources: HuntResources;
  revision: number;
  runtimeGeneration: string;
  version: 1;
  wave: number;
  waveDelayMs: number;
  waveSize: number;
  xpPending: Record<string, number>;
};
export type HuntAdvanceResult = {
  changed: boolean;
  combatEvents: Array<HuntCombatEvent>;
  defeatedEnemies: Array<HuntEngineEnemy>;
  finished: boolean;
};
export type HuntEngineSnapshot = HuntEngineCheckpoint & { runtimeGeneration: string; version: 1 };

type AttackPolicy = {
  abilityId: number;
  abilityName: string;
  category: HuntAbilityResource['category'];
  areaRadius: number;
  cooldownMs: number;
  element: string;
  power: number;
  typeId: number;
  range: number;
};
type ActingEnemy = { enemy: HuntEngineEnemy; policy: AttackPolicy };
type PathNode = { firstStep?: Position; position: Position };

function areaDistance(first: Position, second: Position): number {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y));
}

function positionKey(position: Position): string {
  return `${position.x}:${position.y}`;
}

type BattleStats = {
  attack: number;
  defense: number;
  health: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};
type StatIvs = Pick<
  HuntCreatureResource,
  'ivAttack' | 'ivDefense' | 'ivHealth' | 'ivSpecialAttack' | 'ivSpecialDefense' | 'ivSpeed'
>;

const WILD_IV = 15;

function calculatedStat(base: number, iv: number, level: number, health: boolean): number {
  const scaled = Math.floor(((base * 2 + iv) * level) / 100);
  // Nature will multiply non-HP stats here when creature natures are introduced.
  return health ? scaled + level + 10 : scaled + 5;
}

function battleStats(species: HuntSpeciesResource, level: number, ivs: StatIvs): BattleStats {
  return {
    attack: calculatedStat(species.baseAttack, ivs.ivAttack, level, false),
    defense: calculatedStat(species.baseDefense, ivs.ivDefense, level, false),
    health: calculatedStat(species.baseHealth, ivs.ivHealth, level, true),
    specialAttack: calculatedStat(species.baseSpecialAttack, ivs.ivSpecialAttack, level, false),
    specialDefense: calculatedStat(species.baseSpecialDefense, ivs.ivSpecialDefense, level, false),
    speed: calculatedStat(species.baseSpeed, ivs.ivSpeed, level, false),
  };
}

export function maximumHealthForCreature(
  species: HuntSpeciesResource,
  creature: HuntCreatureResource,
): number {
  return battleStats(species, creature.level, creature).health;
}

function wildStats(species: HuntSpeciesResource, level: number): BattleStats {
  const ivs: StatIvs = {
    ivAttack: WILD_IV,
    ivDefense: WILD_IV,
    ivHealth: WILD_IV,
    ivSpecialAttack: WILD_IV,
    ivSpecialDefense: WILD_IV,
    ivSpeed: WILD_IV,
  };
  return battleStats(species, level, ivs);
}

function evolveAlly(engine: HuntEngine, ally: HuntEngineAlly): void {
  let evolution = engine.resources.evolutions.find(function eligible(candidate): boolean {
    return candidate.fromSpeciesId === ally.speciesId && candidate.requiredLevel <= ally.level;
  });
  while (evolution) {
    const previousMaximumHealth = ally.maximumHealth;
    const nextSpecies = engine.resources.species[String(evolution.toSpeciesId)];
    if (!nextSpecies) {
      return;
    }
    ally.speciesId = nextSpecies.id;
    ally.maximumHealth = battleStats(nextSpecies, ally.level, ally).health;
    ally.health = Math.min(
      ally.maximumHealth,
      Math.round((ally.health / Math.max(1, previousMaximumHealth)) * ally.maximumHealth),
    );
    evolution = engine.resources.evolutions.find(function eligible(candidate): boolean {
      return candidate.fromSpeciesId === ally.speciesId && candidate.requiredLevel <= ally.level;
    });
  }
}

export function experienceForLevel(level: number): bigint {
  const value = BigInt(level);
  return (50n * value * value * value - 150n * value * value + 400n * value) / 3n;
}

export function levelFromExperience(experience: bigint): number {
  let lower = 1n;
  let upper = 32_767n;
  while (lower < upper) {
    const candidate = (lower + upper + 1n) / 2n;
    if (experienceForLevel(Number(candidate)) <= experience) {
      lower = candidate;
    } else {
      upper = candidate - 1n;
    }
  }
  return Number(lower);
}

function shifted(value: number, shift: number): number {
  return value + shift;
}

function buildAllies(
  checkpoint: HuntEngineCheckpoint,
  resources: HuntResources,
): Array<HuntEngineAlly> {
  const allies: Array<HuntEngineAlly> = [];
  const activeCreature = resources.creatures.find(function active(
    creature: HuntCreatureResource,
  ): boolean {
    return creature.id === checkpoint.activeCreatureId;
  });
  if (!activeCreature) {
    throw new TypeError('active_hunt_creature_missing_from_resources');
  }
  for (const creature of resources.creatures) {
    const species = resources.species[String(creature.speciesId)];
    if (!species) {
      continue;
    }
    const maximumHealth = maximumHealthForCreature(species, creature);
    allies.push({
      ...creature,
      health:
        creature.id === checkpoint.activeCreatureId
          ? checkpoint.activeCreatureHealth
          : creature.teamPosition < activeCreature.teamPosition
            ? 0
            : maximumHealth,
      maximumHealth,
    });
  }
  return allies;
}

export function createEngine(
  checkpoint: HuntEngineCheckpoint,
  resources: HuntResources,
  nowEpoch: number,
): HuntEngine {
  const shift = Math.max(0, nowEpoch - checkpoint.capturedAt);
  const enemies = globalThis.structuredClone(checkpoint.enemies);
  for (const enemy of enemies) {
    enemy.nextAttackAt = shifted(enemy.nextAttackAt, shift);
    if (enemy.nextMovementAt !== undefined) {
      enemy.nextMovementAt = shifted(enemy.nextMovementAt, shift);
    }
    if (enemy.movement) {
      enemy.movement.startTime = shifted(enemy.movement.startTime, shift);
    }
  }
  const abilityCooldowns = globalThis.structuredClone(checkpoint.abilityCooldowns ?? {});
  for (const cooldowns of Object.values(abilityCooldowns)) {
    for (const abilityId of Object.keys(cooldowns)) {
      cooldowns[abilityId] = shifted(cooldowns[abilityId], shift);
    }
  }
  const allies = buildAllies(checkpoint, resources);
  const activeAllyIndex = allies.findIndex(function active(ally: HuntEngineAlly): boolean {
    return ally.id === checkpoint.activeCreatureId;
  });
  if (activeAllyIndex < 0) {
    throw new TypeError('active_hunt_creature_species_missing');
  }
  return {
    abilityCooldowns,
    activeAllyIndex,
    activeCreatureAvailableAt: shifted(
      checkpoint.activeCreatureAvailableAt ?? checkpoint.capturedAt,
      shift,
    ),
    activeCreatureSwitchCompletesAt:
      checkpoint.activeCreatureSwitchCompletesAt === undefined
        ? undefined
        : shifted(checkpoint.activeCreatureSwitchCompletesAt, shift),
    activeCreatureSwitchCooldownEndsAt: shifted(
      checkpoint.activeCreatureSwitchCooldownEndsAt ?? checkpoint.capturedAt,
      shift,
    ),
    activeCreatureSwitchTargetId: checkpoint.activeCreatureSwitchTargetId,
    allies,
    enemies,
    enemyActionNotBefore: shifted(checkpoint.enemyActionNotBefore ?? checkpoint.capturedAt, shift),
    finished: allies.length === 0,
    huntId: checkpoint.huntId,
    nextEventAt: shifted(checkpoint.nextEventAt, shift),
    pausedAt: undefined,
    playerPosition: globalThis.structuredClone(checkpoint.playerPosition),
    resources,
    revision: checkpoint.revision,
    runtimeGeneration: randomUUID(),
    version: 1,
    wave: checkpoint.wave,
    waveDelayMs: checkpoint.waveDelayMs,
    waveSize: checkpoint.waveSize,
    xpPending: {},
  };
}

export function switchActiveCreature(
  engine: HuntEngine,
  creatureId: string,
  nowEpoch: number,
): boolean {
  if (
    engine.activeCreatureSwitchCompletesAt !== undefined ||
    engine.activeCreatureSwitchCooldownEndsAt > nowEpoch
  ) {
    return false;
  }
  const nextIndex = engine.allies.findIndex(function matchingAlly(ally: HuntEngineAlly): boolean {
    return ally.id === creatureId && ally.health > 0;
  });
  if (nextIndex < 0 || nextIndex === engine.activeAllyIndex) {
    return false;
  }
  const next = engine.allies[nextIndex];
  const cooldownsForNext = cooldowns(engine, next.id);
  for (const ability of next.abilities) {
    cooldownsForNext[String(ability.id)] = nowEpoch + ability.cooldownMs;
  }
  const completesAt = nowEpoch + ACTIVE_CREATURE_SWITCH_MS;
  engine.activeCreatureAvailableAt = completesAt + ACTIVE_CREATURE_ARRIVAL_MS;
  engine.activeCreatureSwitchCompletesAt = completesAt;
  engine.activeCreatureSwitchCooldownEndsAt = nowEpoch + ACTIVE_CREATURE_SWITCH_COOLDOWN_MS;
  engine.activeCreatureSwitchTargetId = next.id;
  engine.enemyActionNotBefore = engine.activeCreatureAvailableAt;
  engine.nextEventAt = Math.min(engine.nextEventAt, completesAt);
  engine.revision += 1;
  return true;
}

function activeCreatureAvailable(engine: HuntEngine, nowEpoch: number): boolean {
  return nowEpoch >= engine.activeCreatureAvailableAt;
}

function completeActiveCreatureSwitch(engine: HuntEngine, nowEpoch: number): boolean {
  if (
    engine.activeCreatureSwitchCompletesAt === undefined ||
    engine.activeCreatureSwitchCompletesAt > nowEpoch ||
    !engine.activeCreatureSwitchTargetId
  ) {
    return false;
  }
  const nextIndex = engine.allies.findIndex(function matchingAlly(ally: HuntEngineAlly): boolean {
    return ally.id === engine.activeCreatureSwitchTargetId;
  });
  if (nextIndex < 0) {
    throw new TypeError('active_creature_switch_target_missing');
  }
  engine.activeAllyIndex = nextIndex;
  engine.activeCreatureSwitchCompletesAt = undefined;
  engine.activeCreatureSwitchTargetId = undefined;
  return true;
}

function blockedTiles(engine: HuntEngine): Set<string> {
  const blocked = new Set<string>();
  blocked.add(positionKey(ALLY_POSITION));
  blocked.add(positionKey(PLAYER_POSITION));
  for (let x = 2; x < GRID_WIDTH - 2; x += 2) {
    if (x !== ALLY_POSITION.x) {
      const y = 1 + ((x * 3 + engine.resources.locationId) % (GRID_HEIGHT - 2));
      blocked.add(positionKey({ x, y }));
    }
  }
  for (const enemy of engine.enemies) {
    blocked.add(positionKey(enemy.position));
    if (enemy.movement) {
      blocked.add(positionKey(enemy.movement.toTile));
    }
  }
  return blocked;
}

function rarityForEncounterWeight(weight: number): CaptureRarity {
  if (weight >= 20) {
    return 'common';
  }
  if (weight >= 10) {
    return 'uncommon';
  }
  if (weight >= 5) {
    return 'rare';
  }
  if (weight >= 2) {
    return 'epic';
  }
  return 'legendary';
}

function randomEncounter(
  resources: HuntResources,
): HuntSpeciesResource & { level: number; rarity: CaptureRarity } {
  let totalWeight = 0;
  for (const encounter of resources.encounters) {
    totalWeight += encounter.weight;
  }
  let roll = Math.random() * totalWeight;
  let selected = resources.encounters[0];
  for (const encounter of resources.encounters) {
    roll -= encounter.weight;
    if (roll <= 0) {
      selected = encounter;
      break;
    }
  }
  if (!selected) {
    throw new Error('hunting_location_has_no_species');
  }
  const species = resources.species[String(selected.speciesId)];
  if (!species) {
    throw new Error('hunting_species_resource_missing');
  }
  const level =
    selected.minimumLevel +
    Math.floor(Math.random() * (selected.maximumLevel - selected.minimumLevel + 1));
  return { ...species, level, rarity: rarityForEncounterWeight(selected.weight) };
}

function spawnPosition(engine: HuntEngine, blocked: Set<string>): Position {
  const candidates: Array<Position> = [];
  for (let x = 0; x < GRID_WIDTH; x += 1) {
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      const candidate = { x, y };
      if (!blocked.has(positionKey(candidate)) && areaDistance(candidate, ALLY_POSITION) >= 5) {
        candidates.push(candidate);
      }
    }
  }
  return candidates[Math.floor(Math.random() * candidates.length)] ?? { x: 9, y: 3 };
}

function spawnWave(engine: HuntEngine, nowEpoch: number): void {
  const blocked = blockedTiles(engine);
  for (let index = 0; index < engine.waveSize; index += 1) {
    const encounter = randomEncounter(engine.resources);
    const position = spawnPosition(engine, blocked);
    blocked.add(positionKey(position));
    const health = wildStats(encounter, encounter.level).health;
    engine.enemies.push({
      ...encounter,
      combatId: randomUUID(),
      health,
      maximumHealth: health,
      nextAttackAt: nowEpoch,
      nextMovementAt: nowEpoch,
      position,
    });
  }
}

function cooldowns(engine: HuntEngine, actorId: string): Record<string, number> {
  engine.abilityCooldowns[actorId] ??= {};
  return engine.abilityCooldowns[actorId];
}

export function healingItemDue(engine: HuntEngine, nowEpoch: number): boolean {
  const configuration = engine.resources.healingConfiguration;
  const ally = engine.allies[engine.activeAllyIndex];
  if (!configuration || !ally || ally.health === 0) {
    return false;
  }
  const cooldownEndsAt = cooldowns(engine, HEALING_ITEM_COOLDOWN_ACTOR).global ?? 0;
  return (
    cooldownEndsAt <= nowEpoch &&
    ally.health * 100 <= ally.maximumHealth * configuration.thresholdPercentage
  );
}

export function healingItemCooldownEndsAt(engine: HuntEngine): number {
  const cooldowns = engine.abilityCooldowns[HEALING_ITEM_COOLDOWN_ACTOR];
  return cooldowns ? (cooldowns.global ?? 0) : 0;
}

export function applyHealingItem(
  engine: HuntEngine,
  healingAmount: number,
  nowEpoch: number,
): boolean {
  const ally = engine.allies[engine.activeAllyIndex];
  if (!ally || !Number.isSafeInteger(healingAmount) || healingAmount <= 0) {
    return false;
  }
  const nextHealth = Math.min(ally.maximumHealth, ally.health + healingAmount);
  if (nextHealth === ally.health) {
    return false;
  }
  ally.health = nextHealth;
  cooldowns(engine, HEALING_ITEM_COOLDOWN_ACTOR).global = nowEpoch + 1_000;
  engine.revision += 1;
  engine.nextEventAt = Math.min(engine.nextEventAt, nowEpoch + 1_000);
  return true;
}

function policyFor(
  abilities: Array<HuntAbilityResource>,
  level: number,
  actorCooldowns: Record<string, number>,
  nowEpoch: number,
  targetDistance: number,
  random: boolean,
): AttackPolicy | undefined {
  if ((actorCooldowns[GLOBAL_COOLDOWN_KEY] ?? 0) > nowEpoch) {
    return undefined;
  }
  const available: Array<AttackPolicy> = [];
  for (const ability of abilities) {
    const range = ability.rangeTiles;
    if (
      ability.requiredLevel <= level &&
      ability.power !== null &&
      (actorCooldowns[String(ability.id)] ?? 0) <= nowEpoch &&
      targetDistance <= range
    ) {
      available.push({
        abilityId: ability.id,
        abilityName: ability.name,
        areaRadius: ability.areaRadius,
        category: ability.category,
        cooldownMs: ability.cooldownMs,
        element: ability.typeSlug,
        power: ability.power,
        range,
        typeId: ability.typeId,
      });
    }
  }
  if (available.length === 0) {
    return undefined;
  }
  return random ? available[Math.floor(Math.random() * available.length)] : available[0];
}

function startCooldown(
  engine: HuntEngine,
  actorId: string,
  policy: AttackPolicy,
  nowEpoch: number,
): void {
  const actorCooldowns = cooldowns(engine, actorId);
  actorCooldowns[String(policy.abilityId)] = nowEpoch + policy.cooldownMs;
  actorCooldowns[GLOBAL_COOLDOWN_KEY] = nowEpoch + ABILITY_SPACING_MS;
}

function settleMovements(engine: HuntEngine, nowEpoch: number): boolean {
  let changed = false;
  for (const enemy of engine.enemies) {
    if (enemy.movement && enemy.movement.startTime + MOVEMENT_MS <= nowEpoch) {
      enemy.position = enemy.movement.toTile;
      enemy.movement = undefined;
      if (areaDistance(enemy.position, ALLY_POSITION) <= 1) {
        enemy.nextMovementAt = nextAdjacentWanderAt(nowEpoch);
      }
      changed = true;
    }
  }
  return changed;
}

function attackKind(policy: AttackPolicy): HuntCombatEvent['kind'] {
  return policy.areaRadius > 0 ? 'area' : policy.range === 1 ? 'melee' : 'ranged';
}

function typeMultiplier(
  engine: HuntEngine,
  attacker: HuntSpeciesResource,
  defender: HuntSpeciesResource,
  move: AttackPolicy,
): number {
  let multiplier = attacker.typeIds.includes(move.typeId) ? 1.5 : 1;
  for (const defenderTypeId of defender.typeIds) {
    multiplier *=
      engine.resources.typeEffectiveness[String(move.typeId) + ':' + defenderTypeId] ?? 1;
  }
  return multiplier;
}

function damageForAttack(
  engine: HuntEngine,
  attacker: HuntSpeciesResource,
  attackerLevel: number,
  attackerStats: BattleStats,
  defender: HuntSpeciesResource,
  defenderStats: BattleStats,
  policy: AttackPolicy,
): number {
  const physical = policy.category === 'physical';
  const offense = physical ? attackerStats.attack : attackerStats.specialAttack;
  const defense = physical ? defenderStats.defense : defenderStats.specialDefense;
  const effectiveness = typeMultiplier(engine, attacker, defender, policy);
  if (effectiveness === 0) {
    return 0;
  }
  const base =
    Math.floor(
      Math.floor(
        (Math.floor((2 * attackerLevel) / 5 + 2) * policy.power * offense) / Math.max(1, defense),
      ) / 50,
    ) + 2;
  const random = 217 + Math.floor(Math.random() * 39);
  return Math.max(1, Math.floor((Math.floor(base * effectiveness) * random) / 255));
}

function enemyAttack(
  engine: HuntEngine,
  acting: ActingEnemy,
  nowEpoch: number,
  events: Array<HuntCombatEvent>,
): void {
  const ally = engine.allies[engine.activeAllyIndex];
  const allySpecies = engine.resources.species[String(ally.speciesId)];
  const damage = damageForAttack(
    engine,
    acting.enemy,
    acting.enemy.level,
    wildStats(acting.enemy, acting.enemy.level),
    allySpecies,
    battleStats(allySpecies, ally.level, ally),
    acting.policy,
  );
  ally.health = Math.max(0, ally.health - damage);
  startCooldown(engine, acting.enemy.combatId, acting.policy, nowEpoch);
  acting.enemy.nextAttackAt = nowEpoch + ENEMY_SPACING_MS;
  events.push({
    abilityName: acting.policy.abilityName,
    damages: [{ amount: damage, tile: ALLY_POSITION }],
    element: acting.policy.element,
    from: acting.enemy.position,
    id: randomUUID(),
    kind: attackKind(acting.policy),
    occurredAt: nowEpoch,
    tiles: acting.policy.areaRadius > 0 ? [ALLY_POSITION] : [],
    to: ALLY_POSITION,
  });
}

function allyAttack(
  engine: HuntEngine,
  ally: HuntEngineAlly,
  policy: AttackPolicy,
  target: HuntEngineEnemy,
  nowEpoch: number,
  events: Array<HuntCombatEvent>,
): void {
  const species = engine.resources.species[String(ally.speciesId)];
  const damages: Array<{ amount: number; tile: Position }> = [];
  const tiles: Array<Position> = [];
  for (const enemy of engine.enemies) {
    if (areaDistance(enemy.position, target.position) <= policy.areaRadius) {
      const damage = damageForAttack(
        engine,
        species,
        ally.level,
        battleStats(species, ally.level, ally),
        enemy,
        wildStats(enemy, enemy.level),
        policy,
      );
      enemy.health = Math.max(0, enemy.health - damage);
      damages.push({ amount: damage, tile: enemy.position });
      if (policy.areaRadius > 0) {
        tiles.push(enemy.position);
      }
    }
  }
  startCooldown(engine, ally.id, policy, nowEpoch);
  events.push({
    abilityName: policy.abilityName,
    damages,
    element: policy.element,
    from: ALLY_POSITION,
    id: randomUUID(),
    kind: attackKind(policy),
    occurredAt: nowEpoch,
    tiles,
    to: target.position,
  });
}

function processAttacks(
  engine: HuntEngine,
  nowEpoch: number,
  events: Array<HuntCombatEvent>,
): Set<string> {
  const blockedMovers = new Set<string>();
  if (!activeCreatureAvailable(engine, nowEpoch)) {
    return blockedMovers;
  }
  const ally = engine.allies[engine.activeAllyIndex];
  const allySpecies = engine.resources.species[String(ally.speciesId)];
  let allyPolicy: AttackPolicy | undefined;
  let target: HuntEngineEnemy | undefined;
  for (const enemy of engine.enemies) {
    const candidate = policyFor(
      ally.abilities,
      ally.level,
      cooldowns(engine, ally.id),
      nowEpoch,
      areaDistance(ALLY_POSITION, enemy.position),
      false,
    );
    if (
      candidate &&
      (!target ||
        areaDistance(ALLY_POSITION, enemy.position) < areaDistance(ALLY_POSITION, target.position))
    ) {
      allyPolicy = candidate;
      target = enemy;
    }
  }
  const actingEnemies: Array<ActingEnemy> = [];
  for (const enemy of engine.enemies) {
    if (enemy.health === 0 || enemy.movement || enemy.nextAttackAt > nowEpoch) {
      continue;
    }
    if (
      areaDistance(enemy.position, ALLY_POSITION) <= 1 &&
      (enemy.nextMovementAt ?? nowEpoch) <= nowEpoch
    ) {
      continue;
    }
    const policy = policyFor(
      enemy.abilities,
      enemy.level,
      cooldowns(engine, enemy.combatId),
      nowEpoch,
      areaDistance(enemy.position, ALLY_POSITION),
      true,
    );
    if (policy) {
      actingEnemies.push({ enemy, policy });
      blockedMovers.add(enemy.combatId);
    }
  }
  actingEnemies.sort(function attackOrder(first: ActingEnemy, second: ActingEnemy): number {
    return (
      first.enemy.nextAttackAt - second.enemy.nextAttackAt ||
      first.enemy.combatId.localeCompare(second.enemy.combatId)
    );
  });
  const fastestEnemy = actingEnemies.reduce(function fastest(
    current: ActingEnemy | undefined,
    candidate: ActingEnemy,
  ): ActingEnemy {
    return !current ||
      wildStats(candidate.enemy, candidate.enemy.level).speed >
        wildStats(current.enemy, current.enemy.level).speed
      ? candidate
      : current;
  }, undefined);
  const allyFirst =
    allyPolicy &&
    target &&
    (!fastestEnemy ||
      battleStats(allySpecies, ally.level, ally).speed >=
        wildStats(fastestEnemy.enemy, fastestEnemy.enemy.level).speed);
  if (allyFirst && allyPolicy && target) {
    allyAttack(engine, ally, allyPolicy, target, nowEpoch, events);
  }
  const acting = actingEnemies[0];
  if (
    acting &&
    nowEpoch >= engine.enemyActionNotBefore &&
    acting.enemy.health > 0 &&
    ally.health > 0
  ) {
    enemyAttack(engine, acting, nowEpoch, events);
    engine.enemyActionNotBefore = nowEpoch + ENEMY_SPACING_MS;
  }
  if (!allyFirst && ally.health > 0 && allyPolicy && target && target.health > 0) {
    allyAttack(engine, ally, allyPolicy, target, nowEpoch, events);
  }
  return blockedMovers;
}

function isInsideGrid(position: Position): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < GRID_WIDTH && position.y < GRID_HEIGHT;
}

function neighbors(position: Position): Array<Position> {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
  ];
}

function directionTo(from: Position, to: Position): Movement['direction'] {
  if (to.x < from.x) {
    return 'left';
  }
  if (to.x > from.x) {
    return 'right';
  }
  return to.y < from.y ? 'up' : 'down';
}

function nextPathStep(from: Position, occupied: Set<string>): Position | undefined {
  const queue: Array<PathNode> = [{ position: from }];
  const visited = new Set<string>([positionKey(from)]);
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index];
    if (
      areaDistance(node.position, ALLY_POSITION) <= 1 &&
      (node.position.x !== ALLY_POSITION.x || node.position.y !== ALLY_POSITION.y)
    ) {
      return node.firstStep;
    }
    for (const candidate of neighbors(node.position)) {
      const key = positionKey(candidate);
      if (!isInsideGrid(candidate) || occupied.has(key) || visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({
        firstStep: node.firstStep ?? candidate,
        position: candidate,
      });
    }
  }
  return undefined;
}

function adjacentWanderDestination(
  enemy: HuntEngineEnemy,
  occupied: Set<string>,
): Position | undefined {
  const destinations: Array<Position> = [];
  for (const candidate of neighbors(enemy.position)) {
    if (
      isInsideGrid(candidate) &&
      !occupied.has(positionKey(candidate)) &&
      areaDistance(candidate, ALLY_POSITION) <= 1
    ) {
      destinations.push(candidate);
    }
  }
  return destinations[Math.floor(Math.random() * destinations.length)];
}

function wanderingDestination(enemy: HuntEngineEnemy, occupied: Set<string>): Position | undefined {
  const destinations: Array<Position> = [];
  for (const candidate of neighbors(enemy.position)) {
    if (isInsideGrid(candidate) && !occupied.has(positionKey(candidate))) {
      destinations.push(candidate);
    }
  }
  return destinations[Math.floor(Math.random() * destinations.length)];
}

function nextAdjacentWanderAt(nowEpoch: number): number {
  const interval =
    ADJACENT_WANDER_MINIMUM_MS +
    Math.floor(Math.random() * (ADJACENT_WANDER_MAXIMUM_MS - ADJACENT_WANDER_MINIMUM_MS + 1));
  return nowEpoch + interval;
}

function beginMovement(
  enemy: HuntEngineEnemy,
  destination: Position,
  engine: HuntEngine,
  nowEpoch: number,
): void {
  enemy.movement = {
    direction: directionTo(enemy.position, destination),
    durationTicks: 21,
    fromTile: enemy.position,
    mode: 'walking',
    movementId: randomUUID(),
    startTick: engine.revision,
    startTime: nowEpoch,
    toTile: destination,
  };
}

function beginMovements(engine: HuntEngine, nowEpoch: number, blockedMovers: Set<string>): boolean {
  const occupied = blockedTiles(engine);
  let changed = false;
  for (const enemy of engine.enemies) {
    if (
      enemy.health === 0 ||
      enemy.movement ||
      enemy.nextAttackAt > nowEpoch ||
      blockedMovers.has(enemy.combatId)
    ) {
      continue;
    }
    occupied.delete(positionKey(enemy.position));
    const hasTarget = activeCreatureAvailable(engine, nowEpoch);
    const adjacent = hasTarget && areaDistance(enemy.position, ALLY_POSITION) <= 1;
    if (adjacent && (enemy.nextMovementAt ?? nowEpoch) > nowEpoch) {
      occupied.add(positionKey(enemy.position));
      continue;
    }
    let destination: Position | undefined;
    if (hasTarget) {
      destination = adjacent
        ? adjacentWanderDestination(enemy, occupied)
        : nextPathStep(enemy.position, occupied);
    } else {
      destination = wanderingDestination(enemy, occupied);
    }
    if (!destination) {
      enemy.nextMovementAt = nextAdjacentWanderAt(nowEpoch);
      occupied.add(positionKey(enemy.position));
      continue;
    }
    beginMovement(enemy, destination, engine, nowEpoch);
    enemy.nextMovementAt = adjacent ? nextAdjacentWanderAt(nowEpoch) : nowEpoch;
    occupied.add(positionKey(destination));
    changed = true;
  }
  return changed;
}

function resolveDefeats(engine: HuntEngine, nowEpoch: number): Array<HuntEngineEnemy> {
  const defeated: Array<HuntEngineEnemy> = [];
  const surviving: Array<HuntEngineEnemy> = [];
  for (const enemy of engine.enemies) {
    if (enemy.health > 0) {
      surviving.push(enemy);
      continue;
    }
    defeated.push(enemy);
    const ally = engine.allies[engine.activeAllyIndex];
    const gain = enemy.level * 10;
    const pendingExperience = (engine.xpPending[ally.id] ?? 0) + gain;
    if (!Number.isSafeInteger(pendingExperience)) {
      throw new TypeError('hunt_experience_delta_overflow');
    }
    engine.xpPending[ally.id] = pendingExperience;
    ally.experience = (BigInt(ally.experience) + BigInt(gain)).toString();
    ally.level = levelFromExperience(BigInt(ally.experience));
    evolveAlly(engine, ally);
  }
  engine.enemies = surviving;
  const ally = engine.allies[engine.activeAllyIndex];
  if (ally.health === 0) {
    engine.activeAllyIndex += 1;
    if (engine.activeAllyIndex >= engine.allies.length) {
      engine.finished = true;
    }
  }
  if (!engine.finished && engine.enemies.length === 0) {
    engine.wave += 1;
    engine.nextEventAt = nowEpoch + engine.waveDelayMs;
  }
  return defeated;
}

function calculateNextEvent(engine: HuntEngine, nowEpoch: number): number {
  if (engine.enemies.length === 0) {
    return Math.max(nowEpoch, engine.nextEventAt);
  }
  const deadlines: Array<number> = [];
  if (engine.activeCreatureSwitchCompletesAt !== undefined) {
    deadlines.push(engine.activeCreatureSwitchCompletesAt);
  }
  if (engine.activeCreatureAvailableAt > nowEpoch) {
    deadlines.push(engine.activeCreatureAvailableAt);
  }
  let readyAction = false;
  for (const enemy of engine.enemies) {
    deadlines.push(enemy.nextAttackAt);
    if (enemy.movement) {
      deadlines.push(enemy.movement.startTime + MOVEMENT_MS);
    } else if (
      activeCreatureAvailable(engine, nowEpoch) &&
      enemy.health > 0 &&
      enemy.nextAttackAt <= nowEpoch
    ) {
      const policy = policyFor(
        enemy.abilities,
        enemy.level,
        cooldowns(engine, enemy.combatId),
        nowEpoch,
        areaDistance(enemy.position, ALLY_POSITION),
        true,
      );
      if (policy) {
        if (engine.enemyActionNotBefore <= nowEpoch) {
          readyAction = true;
        } else {
          deadlines.push(engine.enemyActionNotBefore);
        }
      }
    }
    if (!enemy.movement && enemy.health > 0 && enemy.nextMovementAt !== undefined) {
      deadlines.push(enemy.nextMovementAt);
    }
  }
  for (const actorCooldowns of Object.values(engine.abilityCooldowns)) {
    deadlines.push(...Object.values(actorCooldowns));
  }
  const future = deadlines.filter(function futureDeadline(value: number): boolean {
    return value > nowEpoch;
  });
  if (readyAction) {
    return nowEpoch;
  }
  return future.length > 0 ? Math.min(...future) : nowEpoch + ENEMY_SPACING_MS;
}

export function advanceEngine(engine: HuntEngine, nowEpoch: number): HuntAdvanceResult {
  const events: Array<HuntCombatEvent> = [];
  const defeatedEnemies: Array<HuntEngineEnemy> = [];
  if (engine.finished || engine.pausedAt !== undefined || nowEpoch < engine.nextEventAt) {
    return { changed: false, combatEvents: events, defeatedEnemies, finished: engine.finished };
  }
  let changed = completeActiveCreatureSwitch(engine, nowEpoch);
  changed = settleMovements(engine, nowEpoch) || changed;
  if (engine.enemies.length === 0) {
    spawnWave(engine, nowEpoch);
    changed = true;
  }
  const blockedMovers = processAttacks(engine, nowEpoch, events);
  const movementChanged = beginMovements(engine, nowEpoch, blockedMovers);
  changed = events.length > 0 || movementChanged || changed;
  const resolvedDefeats = resolveDefeats(engine, nowEpoch);
  defeatedEnemies.push(...resolvedDefeats);
  changed = resolvedDefeats.length > 0 || changed;
  engine.nextEventAt = calculateNextEvent(engine, nowEpoch);
  if (changed) {
    engine.revision += 1;
  }
  return { changed, combatEvents: events, defeatedEnemies, finished: engine.finished };
}

export function pauseEngine(engine: HuntEngine, nowEpoch: number): boolean {
  if (engine.pausedAt !== undefined) {
    return false;
  }
  engine.pausedAt = nowEpoch;
  return true;
}

function shiftEngineDeadlines(state: HuntEngine | HuntEngineSnapshot, shift: number): void {
  const emptyCooldowns: Record<string, Record<string, number>> = {};
  const abilityCooldowns = state.abilityCooldowns ?? emptyCooldowns;
  state.nextEventAt += shift;
  state.activeCreatureAvailableAt = (state.activeCreatureAvailableAt ?? state.capturedAt) + shift;
  state.activeCreatureSwitchCooldownEndsAt =
    (state.activeCreatureSwitchCooldownEndsAt ?? state.capturedAt) + shift;
  if (state.activeCreatureSwitchCompletesAt !== undefined) {
    state.activeCreatureSwitchCompletesAt += shift;
  }
  if (state.enemyActionNotBefore !== undefined) {
    state.enemyActionNotBefore += shift;
  }
  for (const enemy of state.enemies) {
    enemy.nextAttackAt += shift;
    if (enemy.nextMovementAt !== undefined) {
      enemy.nextMovementAt += shift;
    }
    if (enemy.movement) {
      enemy.movement.startTime += shift;
    }
  }
  for (const actorCooldowns of Object.values(abilityCooldowns)) {
    for (const abilityId of Object.keys(actorCooldowns)) {
      actorCooldowns[abilityId] += shift;
    }
  }
}

export function resumeEngine(engine: HuntEngine, nowEpoch: number): boolean {
  if (engine.pausedAt === undefined) {
    return false;
  }
  const shift = Math.max(0, nowEpoch - engine.pausedAt);
  shiftEngineDeadlines(engine, shift);
  engine.pausedAt = undefined;
  return true;
}

export function snapshotEngine(engine: HuntEngine, nowEpoch: number): HuntEngineSnapshot {
  const active = engine.allies[engine.activeAllyIndex];
  const activeHealth = active ? active.health : 0;
  const activeId = active ? active.id : '';
  const snapshot: HuntEngineSnapshot = globalThis.structuredClone({
    abilityCooldowns: engine.abilityCooldowns,
    activeCreatureAvailableAt: engine.activeCreatureAvailableAt,
    activeCreatureHealth: activeHealth,
    activeCreatureId: activeId,
    activeCreatureSwitchCompletesAt: engine.activeCreatureSwitchCompletesAt,
    activeCreatureSwitchCooldownEndsAt: engine.activeCreatureSwitchCooldownEndsAt,
    activeCreatureSwitchTargetId: engine.activeCreatureSwitchTargetId,
    capturedAt: nowEpoch,
    enemies: engine.enemies,
    enemyActionNotBefore: engine.enemyActionNotBefore,
    huntId: engine.huntId,
    nextEventAt: engine.nextEventAt,
    pausedAt: engine.pausedAt,
    playerPosition: engine.playerPosition,
    revision: engine.revision,
    runtimeGeneration: engine.runtimeGeneration,
    version: 1,
    wave: engine.wave,
    waveDelayMs: engine.waveDelayMs,
    waveSize: engine.waveSize,
    xpPending: engine.xpPending,
  });
  if (snapshot.pausedAt !== undefined) {
    const shift = Math.max(0, nowEpoch - snapshot.pausedAt);
    shiftEngineDeadlines(snapshot, shift);
    snapshot.pausedAt = nowEpoch;
  }
  return snapshot;
}
