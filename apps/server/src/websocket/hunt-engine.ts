/* eslint-disable complexity, max-lines, max-lines-per-function, no-shadow, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types, unicorn/no-array-reduce, unicorn/no-immediate-mutation, unicorn/no-useless-undefined */
import { randomUUID } from 'node:crypto';

import type { CaptureRarity } from './capture-items.ts';
import type { Movement, Position } from './game-types.ts';
import type {
  HuntAbilityResource,
  HuntBattleStat,
  HuntCreatureResource,
  HuntMoveEffectResource,
  HuntNatureResource,
  HuntResources,
  HuntSpeciesResource,
  HuntStatus,
} from './hunt-resources.ts';

const ALLY_POSITION: Position = { x: 6, y: 3 };
const GRID_HEIGHT = 8;
const GRID_WIDTH = 12;
const MOVEMENT_MS = 694;
const ABILITY_SPACING_MS = 1_500;
const ENEMY_SPACING_MS = 150;
const CRITICAL_HIT_CHANCE = 1 / 24;
const CRITICAL_HIT_MULTIPLIER = 1.5;
const GLOBAL_COOLDOWN_KEY = 'global';
const HEALING_ITEM_COOLDOWN_ACTOR = 'healing-item';
const ADJACENT_WANDER_MINIMUM_MS = 2_500;
const ADJACENT_WANDER_MAXIMUM_MS = 4_500;
const ACTIVE_CREATURE_SWITCH_MS = 1_000;
const ACTIVE_CREATURE_ARRIVAL_MS = 320;
const ACTIVE_CREATURE_SWITCH_COOLDOWN_MS = 7_000;
const STATUS_TICK_MS = 5_000;

export type HuntCombatEvent = {
  abilityName: string;
  damages: Array<{ amount: number; effectiveness: CombatEffectiveness; tile: Position }>;
  element: string;
  evolution?: { fromSpeciesId: number; toSpeciesId: number };
  from: Position;
  id: string;
  kind: 'area' | 'melee' | 'ranged';
  occurredAt: number;
  feedback: Array<{ text: string; tile: Position }>;
  tiles: Array<Position>;
  to: Position;
};
export type CombatEffectiveness = 'normal' | 'resisted' | 'super-effective';
type StatIvs = Pick<
  HuntCreatureResource,
  'ivAttack' | 'ivDefense' | 'ivHealth' | 'ivSpecialAttack' | 'ivSpecialDefense' | 'ivSpeed'
>;
type StatEvs = Pick<
  HuntCreatureResource,
  'evAttack' | 'evDefense' | 'evHealth' | 'evSpecialAttack' | 'evSpecialDefense' | 'evSpeed'
>;
export type HuntStatStages = Record<HuntBattleStat, number>;
export type HuntCondition = {
  majorStatusEndsAt?: number;
  majorStatus?: Exclude<HuntStatus, 'confusion'>;
  confusionEndsAt?: number;
  flinchPending?: boolean;
  physicalScreenEndsAt?: number;
  recurringDamagePercentage?: number;
  recurringEndsAt?: number;
  recurringRequiresSleep?: boolean;
  recurringTickAt?: number;
  specialScreenEndsAt?: number;
  nextTickAt?: number;
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
  condition?: HuntCondition;
  statStages?: HuntStatStages;
} & StatIvs;
export type HuntEngineAlly = HuntCreatureResource & {
  health: number;
  maximumHealth: number;
  statStages: HuntStatStages;
  condition: HuntCondition;
};
export type HuntEngineCheckpoint = {
  activeCreatureAvailableAt?: number;
  activeCreatureSwitchCompletesAt?: number;
  activeCreatureSwitchCooldownEndsAt?: number;
  activeCreatureSwitchTargetId?: string;
  allyHealth?: Record<string, number>;
  allyEffortValues?: Record<string, StatEvs>;
  allyStatStages?: Record<string, HuntStatStages>;
  allyConditions?: Record<string, HuntCondition>;
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
  waveRange: HuntWaveRange;
  waveSize: number;
  xpPending?: Record<string, number>;
};
export type HuntWaveRange = { maximumSize: number; minimumSize: number };
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
  waveRange: HuntWaveRange;
  waveSize: number;
  xpPending: Record<string, number>;
};
export type HuntAdvanceResult = {
  changed: boolean;
  changes: Array<HuntAdvanceChange>;
  combatEvents: Array<HuntCombatEvent>;
  defeatedEnemies: Array<HuntEngineEnemy>;
  enemyPatches: Array<HuntEngineEnemyPatch>;
  finished: boolean;
  removedEnemyCombatIds: Array<string>;
  spawnedEnemies: Array<HuntEngineEnemy>;
};
export type HuntAdvanceChange =
  | 'active-creature'
  | 'active-creature-abilities'
  | 'active-creature-experience'
  | 'active-creature-health'
  | 'enemies'
  | 'wave';
export type HuntEngineEnemyPatch = {
  combatId: string;
  health?: number;
  movement?: Movement | null;
  position?: Position;
};
export type HuntEngineSnapshot = HuntEngineCheckpoint & { runtimeGeneration: string; version: 1 };

type AttackPolicy = {
  accuracy: number | null;
  abilityId: number;
  abilityName: string;
  category: HuntAbilityResource['category'];
  areaRadius: number;
  cooldownMs: number;
  delivery: HuntAbilityResource['delivery'];
  element: string;
  moveEffects: Array<HuntMoveEffectResource>;
  power: number;
  priority: number;
  target: HuntAbilityResource['target'];
  typeId: number;
  range: number;
};
type DamageResult = { amount: number; critical: boolean; effectiveness: CombatEffectiveness };
type ActingEnemy = { enemy: HuntEngineEnemy; policy: AttackPolicy };
type EnemyAttackResult = { damagedAlly: boolean; enemyHealthChanged: boolean };
type PathNode = { firstStep?: Position; position: Position };
type AttackResult = {
  blockedMovers: Set<string>;
  changes: Set<HuntAdvanceChange>;
  damagedEnemyCombatIds: Set<string>;
};

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
const EMPTY_EVS: StatEvs = {
  evAttack: 0,
  evDefense: 0,
  evHealth: 0,
  evSpecialAttack: 0,
  evSpecialDefense: 0,
  evSpeed: 0,
};
const NEUTRAL_NATURE: HuntNatureResource = {
  decreasedStat: null,
  increasedStat: null,
  slug: 'hardy',
};
const STAGE_MULTIPLIERS = [0.25, 0.28, 0.33, 0.4, 0.5, 0.66, 1, 1.5, 2, 2.5, 3, 3.5, 4];

function emptyStatStages(): HuntStatStages {
  return {
    accuracy: 0,
    attack: 0,
    defense: 0,
    evasion: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };
}

function natureMultiplier(
  nature: HuntNatureResource,
  stat: HuntNatureResource['increasedStat'],
): number {
  if (nature.increasedStat === stat) {
    return 1.1;
  }
  return nature.decreasedStat === stat ? 0.9 : 1;
}

function calculatedStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  stat: HuntNatureResource['increasedStat'] | 'health',
  nature: HuntNatureResource,
): number {
  const scaled = Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === 'health') {
    return scaled + level + 10;
  }
  return Math.floor((scaled + 5) * natureMultiplier(nature, stat));
}

function battleStats(
  species: HuntSpeciesResource,
  level: number,
  values: StatIvs & Partial<StatEvs> & Partial<Pick<HuntCreatureResource, 'nature'>>,
): BattleStats {
  const evs = { ...EMPTY_EVS, ...values };
  const nature = values.nature ?? NEUTRAL_NATURE;
  return {
    attack: calculatedStat(
      species.baseAttack,
      values.ivAttack,
      evs.evAttack,
      level,
      'attack',
      nature,
    ),
    defense: calculatedStat(
      species.baseDefense,
      values.ivDefense,
      evs.evDefense,
      level,
      'defense',
      nature,
    ),
    health: calculatedStat(
      species.baseHealth,
      values.ivHealth,
      evs.evHealth,
      level,
      'health',
      nature,
    ),
    specialAttack: calculatedStat(
      species.baseSpecialAttack,
      values.ivSpecialAttack,
      evs.evSpecialAttack,
      level,
      'specialAttack',
      nature,
    ),
    specialDefense: calculatedStat(
      species.baseSpecialDefense,
      values.ivSpecialDefense,
      evs.evSpecialDefense,
      level,
      'specialDefense',
      nature,
    ),
    speed: calculatedStat(species.baseSpeed, values.ivSpeed, evs.evSpeed, level, 'speed', nature),
  };
}

export function maximumHealthForCreature(
  species: HuntSpeciesResource,
  creature: HuntCreatureResource,
): number {
  return battleStats(species, creature.level, creature).health;
}

function wildStats(species: HuntSpeciesResource, level: number, ivs: StatIvs): BattleStats {
  return battleStats(species, level, ivs);
}

function evolveAlly(
  engine: HuntEngine,
  ally: HuntEngineAlly,
): Array<{ fromSpeciesId: number; toSpeciesId: number }> {
  const evolved: Array<{ fromSpeciesId: number; toSpeciesId: number }> = [];
  let evolution = engine.resources.evolutions.find(function eligible(candidate): boolean {
    return candidate.fromSpeciesId === ally.speciesId && candidate.requiredLevel <= ally.level;
  });
  while (evolution) {
    const previousMaximumHealth = ally.maximumHealth;
    const nextSpecies = engine.resources.species[String(evolution.toSpeciesId)];
    if (!nextSpecies) {
      return evolved;
    }
    const fromSpeciesId = ally.speciesId;
    ally.speciesId = nextSpecies.id;
    evolved.push({ fromSpeciesId, toSpeciesId: nextSpecies.id });
    ally.maximumHealth = battleStats(nextSpecies, ally.level, ally).health;
    ally.health = Math.min(
      ally.maximumHealth,
      Math.round((ally.health / Math.max(1, previousMaximumHealth)) * ally.maximumHealth),
    );
    evolution = engine.resources.evolutions.find(function eligible(candidate): boolean {
      return candidate.fromSpeciesId === ally.speciesId && candidate.requiredLevel <= ally.level;
    });
  }
  return evolved;
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
    const persistedHealth = checkpoint.allyHealth ? checkpoint.allyHealth[creature.id] : undefined;
    const persistedStages = checkpoint.allyStatStages;
    const persistedConditions = checkpoint.allyConditions;
    const condition = persistedConditions ? (persistedConditions[creature.id] ?? {}) : {};
    const statStages = persistedStages
      ? (persistedStages[creature.id] ?? emptyStatStages())
      : emptyStatStages();
    allies.push({
      ...creature,
      condition,
      health:
        creature.id === checkpoint.activeCreatureId
          ? checkpoint.activeCreatureHealth
          : (persistedHealth ?? maximumHealth),
      maximumHealth,
      statStages,
    });
  }
  allies.sort(function bySlot(first: HuntEngineAlly, second: HuntEngineAlly): number {
    return first.teamPosition - second.teamPosition;
  });
  return allies;
}

function conditionText(status: HuntStatus): string {
  return status === 'confusion' ? 'Confused' : `${status[0].toUpperCase()}${status.slice(1)}`;
}

function applyStatusEffects(
  effects: Array<HuntMoveEffectResource>,
  condition: HuntCondition,
  nowEpoch: number,
  targetTile: Position,
  feedback: Array<{ text: string; tile: Position }>,
): void {
  if (!effects) {
    return;
  }
  for (const effect of effects) {
    const statuses = effect.parameters.statuses;
    const randomStatuses = Array.isArray(statuses)
      ? statuses.filter(function isKnownStatus(status): status is HuntStatus {
          return (
            status === 'confusion' ||
            status === 'burn' ||
            status === 'freeze' ||
            status === 'paralysis' ||
            status === 'poison' ||
            status === 'sleep'
          );
        })
      : [];
    const status =
      effect.kind === 'random_status'
        ? randomStatuses[Math.floor(Math.random() * randomStatuses.length)]
        : effect.status;
    if ((effect.kind !== 'status' && effect.kind !== 'random_status') || !status) {
      continue;
    }
    if (Math.random() * 100 >= effect.chance) {
      continue;
    }
    if (status === 'confusion') {
      condition.confusionEndsAt = nowEpoch + 20_000;
      feedback.push({ text: conditionText(status), tile: targetTile });
      continue;
    }
    if (condition.majorStatus) {
      continue;
    }
    condition.majorStatus = status;
    if (status === 'sleep' || status === 'freeze') {
      condition.majorStatusEndsAt = nowEpoch + 15_000;
    }
    condition.nextTickAt = nowEpoch + STATUS_TICK_MS;
    feedback.push({ text: conditionText(status), tile: targetTile });
  }
}

function applyFlinch(
  effects: Array<HuntMoveEffectResource>,
  condition: HuntCondition,
  targetTile: Position,
  feedback: Array<{ text: string; tile: Position }>,
): void {
  for (const effect of effects) {
    if (effect.kind !== 'action_block' || Math.random() * 100 >= effect.chance) {
      continue;
    }
    condition.flinchPending = true;
    feedback.push({ text: 'Flinched', tile: targetTile });
  }
}

function applyRecurringEffect(
  effects: Array<HuntMoveEffectResource>,
  condition: HuntCondition,
  nowEpoch: number,
): void {
  for (const effect of effects) {
    if (effect.kind !== 'recurring_damage' || effect.magnitude === null) {
      continue;
    }
    const intervalMs = effect.intervalMs ?? STATUS_TICK_MS;
    const minimumTicks = effect.durationMinTicks;
    const maximumTicks = effect.durationMaxTicks;
    const durationTicks =
      minimumTicks === null
        ? undefined
        : minimumTicks +
          Math.floor(Math.random() * ((maximumTicks ?? minimumTicks) - minimumTicks + 1));
    condition.recurringDamagePercentage = effect.magnitude;
    condition.recurringEndsAt =
      durationTicks === undefined ? undefined : nowEpoch + durationTicks * intervalMs;
    condition.recurringRequiresSleep = effect.requirement === 'target_asleep' || undefined;
    condition.recurringTickAt = nowEpoch + intervalMs;
  }
}

function applyDamageScreen(
  effects: Array<HuntMoveEffectResource>,
  condition: HuntCondition,
  nowEpoch: number,
  tile: Position,
  feedback: Array<{ text: string; tile: Position }>,
): void {
  for (const effect of effects) {
    if (effect.kind !== 'damage_screen') {
      continue;
    }
    const durationTicks = numericParameter(effect, 'duration_ticks', 5);
    const category = effect.parameters.category;
    if (category === 'physical') {
      condition.physicalScreenEndsAt = nowEpoch + durationTicks * STATUS_TICK_MS;
      feedback.push({ text: 'Physical screen', tile });
    } else if (category === 'special') {
      condition.specialScreenEndsAt = nowEpoch + durationTicks * STATUS_TICK_MS;
      feedback.push({ text: 'Special screen', tile });
    }
  }
}

function applySelfEffects(
  effects: Array<HuntMoveEffectResource>,
  condition: HuntCondition,
  health: number,
  maximumHealth: number,
  nowEpoch: number,
  tile: Position,
  feedback: Array<{ text: string; tile: Position }>,
): number {
  let nextHealth = health;
  for (const effect of effects) {
    if (effect.kind === 'full_heal_and_sleep') {
      const turns = numericParameter(effect, 'turns', 2);
      nextHealth = maximumHealth;
      condition.majorStatus = 'sleep';
      condition.majorStatusEndsAt = nowEpoch + turns * STATUS_TICK_MS;
      condition.nextTickAt = nowEpoch + STATUS_TICK_MS;
      feedback.push({ text: 'Restored and asleep', tile });
    }
    if (effect.kind === 'self_faint') {
      nextHealth = 0;
      feedback.push({ text: 'Fainted', tile });
    }
  }
  return nextHealth;
}

function missRecoil(
  effects: Array<HuntMoveEffectResource>,
  health: number,
  maximumHealth: number,
  tile: Position,
  feedback: Array<{ text: string; tile: Position }>,
): number {
  const effect = effectOfKind(effects, 'miss_recoil');
  if (!effect) {
    return health;
  }
  const percentage = numericParameter(effect, 'percentage', 50);
  const amount = Math.max(1, Math.floor((maximumHealth * percentage) / 100));
  feedback.push({ text: `Recoil ${amount} HP`, tile });
  return Math.max(0, health - amount);
}

function requirementsMet(
  effects: Array<HuntMoveEffectResource>,
  condition: HuntCondition | undefined,
): boolean {
  for (const effect of effects) {
    if (
      effect.kind === 'target_requirement' &&
      effect.requirement === 'target_asleep' &&
      (!condition || condition.majorStatus !== 'sleep')
    ) {
      return false;
    }
  }
  return true;
}

function actionBlockFeedback(
  condition: HuntCondition | undefined,
  nowEpoch: number,
): string | undefined {
  if (!condition) {
    return undefined;
  }
  if (condition.flinchPending) {
    condition.flinchPending = undefined;
    return 'Flinched';
  }
  if (condition.confusionEndsAt !== undefined) {
    if (condition.confusionEndsAt <= nowEpoch) {
      condition.confusionEndsAt = undefined;
    } else if (Math.random() < 1 / 3) {
      return 'Confused';
    }
  }
  if (!condition.majorStatus) {
    return undefined;
  }
  if (condition.majorStatusEndsAt !== undefined && condition.majorStatusEndsAt <= nowEpoch) {
    condition.majorStatus = undefined;
    condition.majorStatusEndsAt = undefined;
    return undefined;
  }
  if (condition.majorStatus === 'sleep') {
    return 'Asleep';
  }
  if (condition.majorStatus === 'freeze') {
    if (Math.random() < 0.2) {
      condition.majorStatus = undefined;
      condition.majorStatusEndsAt = undefined;
      return undefined;
    }
    return 'Frozen';
  }
  return condition.majorStatus === 'paralysis' && Math.random() < 0.25 ? 'Paralyzed' : undefined;
}

function applyConditionTick(
  condition: HuntCondition,
  health: number,
  maximumHealth: number,
  nowEpoch: number,
): number {
  let nextHealth = health;
  if (
    (condition.majorStatus === 'burn' || condition.majorStatus === 'poison') &&
    condition.nextTickAt !== undefined &&
    condition.nextTickAt <= nowEpoch
  ) {
    condition.nextTickAt = nowEpoch + STATUS_TICK_MS;
    nextHealth = Math.max(0, nextHealth - Math.max(1, Math.floor(maximumHealth / 16)));
  }
  if (
    condition.recurringDamagePercentage !== undefined &&
    condition.recurringTickAt !== undefined &&
    condition.recurringTickAt <= nowEpoch
  ) {
    if (condition.recurringEndsAt !== undefined && condition.recurringEndsAt <= nowEpoch) {
      condition.recurringDamagePercentage = undefined;
      condition.recurringEndsAt = undefined;
      condition.recurringRequiresSleep = undefined;
      condition.recurringTickAt = undefined;
    } else if (!condition.recurringRequiresSleep || condition.majorStatus === 'sleep') {
      condition.recurringTickAt = nowEpoch + STATUS_TICK_MS;
      nextHealth = Math.max(
        0,
        nextHealth -
          Math.max(1, Math.floor((maximumHealth * condition.recurringDamagePercentage) / 100)),
      );
    }
  }
  return nextHealth;
}

function applyConditionTicks(
  engine: HuntEngine,
  nowEpoch: number,
): { allyChanged: boolean; enemies: Array<HuntEngineEnemy> } {
  const changedEnemies: Array<HuntEngineEnemy> = [];
  const ally = engine.allies[engine.activeAllyIndex];
  let allyChanged = false;
  if (ally) {
    const nextHealth = applyConditionTick(
      ally.condition,
      ally.health,
      ally.maximumHealth,
      nowEpoch,
    );
    allyChanged = nextHealth !== ally.health;
    ally.health = nextHealth;
  }
  for (const enemy of engine.enemies) {
    const condition = enemy.condition;
    if (!condition) {
      continue;
    }
    const nextHealth = applyConditionTick(condition, enemy.health, enemy.maximumHealth, nowEpoch);
    if (nextHealth !== enemy.health) {
      enemy.health = nextHealth;
      changedEnemies.push(enemy);
    }
  }
  return { allyChanged, enemies: changedEnemies };
}

export function createEngine(
  checkpoint: HuntEngineCheckpoint,
  resources: HuntResources,
  nowEpoch: number,
): HuntEngine {
  const shift = Math.max(0, nowEpoch - checkpoint.capturedAt);
  const enemies = globalThis.structuredClone(checkpoint.enemies);
  for (const enemy of enemies) {
    enemy.statStages ??= emptyStatStages();
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
    waveRange: checkpoint.waveRange,
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
  engine.allies[engine.activeAllyIndex].statStages = emptyStatStages();
  next.statStages = emptyStatStages();
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

function creaturePosition(engine: HuntEngine): Position {
  const mapData = engine.resources.mapData;
  const creatureSpawn =
    mapData && mapData.specialTiles
      ? mapData.specialTiles.find(function isCreature(t) {
          return t.kind === 'creature_spawn';
        })
      : undefined;
  return creatureSpawn ? { x: creatureSpawn.x, y: creatureSpawn.y } : ALLY_POSITION;
}

function blockedTiles(engine: HuntEngine): Set<string> {
  const blocked = new Set<string>();
  const allyPos = creaturePosition(engine);
  blocked.add(positionKey(allyPos));
  blocked.add(positionKey(engine.playerPosition));

  const mapData = engine.resources.mapData;
  if (mapData && Array.isArray(mapData.specialTiles)) {
    for (const tile of mapData.specialTiles) {
      if (tile.kind === 'blocked') {
        blocked.add(positionKey({ x: tile.x, y: tile.y }));
      }
    }
  } else {
    for (let x = 2; x < GRID_WIDTH - 2; x += 2) {
      if (x !== allyPos.x) {
        const y = 1 + ((x * 3 + engine.resources.locationId) % (GRID_HEIGHT - 2));
        blocked.add(positionKey({ x, y }));
      }
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

function randomWildIvs(): StatIvs {
  return {
    ivAttack: Math.floor(Math.random() * 32),
    ivDefense: Math.floor(Math.random() * 32),
    ivHealth: Math.floor(Math.random() * 32),
    ivSpecialAttack: Math.floor(Math.random() * 32),
    ivSpecialDefense: Math.floor(Math.random() * 32),
    ivSpeed: Math.floor(Math.random() * 32),
  };
}

function rarityForIvs(ivs: StatIvs): CaptureRarity {
  const total =
    ivs.ivAttack +
    ivs.ivDefense +
    ivs.ivHealth +
    ivs.ivSpecialAttack +
    ivs.ivSpecialDefense +
    ivs.ivSpeed;
  if (total <= 74) {
    return 'common';
  }
  if (total <= 111) {
    return 'uncommon';
  }
  if (total <= 139) {
    return 'rare';
  }
  if (total <= 167) {
    return 'epic';
  }
  return 'legendary';
}

function randomEncounter(resources: HuntResources): HuntSpeciesResource & { level: number } {
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
  return { ...species, level };
}

function spawnPosition(engine: HuntEngine, blocked: Set<string>): Position {
  const mapData = engine.resources.mapData;
  const enemySpawns =
    mapData && mapData.specialTiles
      ? mapData.specialTiles.filter(function isEnemySpawn(t) {
          return t.kind === 'enemy_spawn';
        })
      : undefined;

  if (enemySpawns && enemySpawns.length > 0) {
    const available = enemySpawns.filter(function notOccupied(s) {
      return !blocked.has(positionKey({ x: s.x, y: s.y }));
    });
    const pool = available.length > 0 ? available : enemySpawns;
    const selected = pool[Math.floor(Math.random() * pool.length)];
    return { x: selected.x, y: selected.y };
  }

  const allyPos = creaturePosition(engine);
  const candidates: Array<Position> = [];
  const width = mapData && mapData.width ? mapData.width : GRID_WIDTH;
  const height = mapData && mapData.height ? mapData.height : GRID_HEIGHT;
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const candidate = { x, y };
      if (!blocked.has(positionKey(candidate)) && areaDistance(candidate, allyPos) >= 5) {
        candidates.push(candidate);
      }
    }
  }
  return (
    candidates[Math.floor(Math.random() * candidates.length)] ?? {
      x: width - 3,
      y: Math.floor(height / 2),
    }
  );
}

function spawnWave(engine: HuntEngine, nowEpoch: number): Array<HuntEngineEnemy> {
  engine.waveSize = randomWaveSize(engine.waveRange);
  const blocked = blockedTiles(engine);
  const spawned: Array<HuntEngineEnemy> = [];
  for (let index = 0; index < engine.waveSize; index += 1) {
    const encounter = randomEncounter(engine.resources);
    const ivs = randomWildIvs();
    const position = spawnPosition(engine, blocked);
    blocked.add(positionKey(position));
    const health = wildStats(encounter, encounter.level, ivs).health;
    const enemy = {
      ...encounter,
      ...ivs,
      combatId: randomUUID(),
      health,
      maximumHealth: health,
      nextAttackAt: nowEpoch,
      nextMovementAt: nowEpoch,
      position,
      rarity: rarityForIvs(ivs),
    } satisfies HuntEngineEnemy;
    engine.enemies.push(enemy);
    spawned.push(enemy);
  }
  return spawned;
}

function randomWaveSize(range: HuntWaveRange): number {
  const length = range.maximumSize - range.minimumSize + 1;
  return range.minimumSize + Math.floor(Math.random() * length);
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

function isDamagingEffect(effect: HuntMoveEffectResource): boolean {
  return (
    effect.kind === 'damage' ||
    effect.kind === 'fixed_damage' ||
    effect.kind === 'level_damage' ||
    effect.kind === 'one_hit_ko' ||
    effect.kind === 'target_health_fraction'
  );
}

function isStatStageEffect(effect: HuntMoveEffectResource): boolean {
  return effect.kind === 'stat_stage' && effect.stat !== null && effect.magnitude !== null;
}

function isStatStageSaturated(
  ability: HuntAbilityResource,
  userStages: HuntStatStages | undefined,
  targetStages: HuntStatStages | undefined,
): boolean {
  if (ability.moveEffects.some(isDamagingEffect)) {
    return false;
  }
  const statEffects = ability.moveEffects.filter(isStatStageEffect);
  if (statEffects.length === 0) {
    return false;
  }
  for (const effect of statEffects) {
    const stat = effect.stat;
    const magnitude = effect.magnitude;
    if (!stat || magnitude === null || magnitude === 0) {
      continue;
    }
    const stages = effect.target === 'user' ? userStages : targetStages;
    const current = stages ? stages[stat] : 0;
    if (magnitude > 0 && current < 6) {
      return false;
    }
    if (magnitude < 0 && current > -6) {
      return false;
    }
  }
  return true;
}

function policyFor(
  abilities: Array<HuntAbilityResource>,
  level: number,
  actorCooldowns: Record<string, number>,
  nowEpoch: number,
  targetDistance: number | undefined,
  random: boolean,
  userStages?: HuntStatStages,
  targetStages?: HuntStatStages,
): AttackPolicy | undefined {
  if ((actorCooldowns[GLOBAL_COOLDOWN_KEY] ?? 0) > nowEpoch) {
    return undefined;
  }
  const available: Array<AttackPolicy> = [];
  for (const ability of abilities) {
    const range = ability.rangeTiles;
    if (
      ability.requiredLevel <= level &&
      ability.moveEffects.length > 0 &&
      (actorCooldowns[String(ability.id)] ?? 0) <= nowEpoch &&
      (isAllyTarget(ability.target)
        ? targetDistance === undefined
        : targetDistance !== undefined && targetDistance <= range) &&
      !isStatStageSaturated(ability, userStages, targetStages)
    ) {
      available.push({
        abilityId: ability.id,
        abilityName: ability.name,
        accuracy: ability.accuracy,
        areaRadius: ability.areaRadius,
        category: ability.category,
        cooldownMs: ability.cooldownMs,
        delivery: ability.delivery,
        element: ability.typeSlug,
        moveEffects: ability.moveEffects,
        power: ability.power ?? 0,
        priority: ability.priority,
        range,
        target: ability.target,
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

function settleMovements(engine: HuntEngine, nowEpoch: number): Array<HuntEngineEnemy> {
  const settled: Array<HuntEngineEnemy> = [];
  const allyPos = creaturePosition(engine);
  for (const enemy of engine.enemies) {
    if (enemy.movement && enemy.movement.startTime + MOVEMENT_MS <= nowEpoch) {
      enemy.position = enemy.movement.toTile;
      enemy.movement = undefined;
      if (areaDistance(enemy.position, allyPos) <= 1) {
        enemy.nextMovementAt = nextAdjacentWanderAt(nowEpoch);
      }
      settled.push(enemy);
    }
  }
  return settled;
}

function attackKind(policy: AttackPolicy): HuntCombatEvent['kind'] {
  return policy.areaRadius > 0 ? 'area' : policy.delivery;
}

function isAllyTarget(target: AttackPolicy['target']): boolean {
  return target === 'self' || target === 'ally' || target === 'all_allies';
}

function targetsAllEnemies(target: AttackPolicy['target']): boolean {
  return target === 'all_adjacent' || target === 'all_enemies' || target === 'field';
}

function effectivenessMultiplier(
  engine: HuntEngine,
  attacker: HuntSpeciesResource,
  defender: HuntSpeciesResource,
  move: AttackPolicy,
): number {
  let multiplier = 1;
  for (const defenderTypeId of defender.typeIds) {
    multiplier *=
      engine.resources.typeEffectiveness[String(move.typeId) + ':' + defenderTypeId] ?? 1;
  }
  return multiplier;
}

function combatEffectiveness(multiplier: number): CombatEffectiveness {
  if (multiplier > 1) {
    return 'super-effective';
  }
  if (multiplier < 1) {
    return 'resisted';
  }
  return 'normal';
}

function stageMultiplier(stage: number): number {
  return STAGE_MULTIPLIERS[Math.max(-6, Math.min(6, stage)) + 6] ?? 1;
}

function accuracyStageMultiplier(stage: number): number {
  const limitedStage = Math.max(-6, Math.min(6, stage));
  return limitedStage >= 0 ? (3 + limitedStage) / 3 : 3 / (3 - limitedStage);
}

function modifiedStat(value: number, stage: number): number {
  return Math.max(1, Math.floor(value * stageMultiplier(stage)));
}

function moveHits(
  policy: AttackPolicy,
  attackerStages: HuntStatStages,
  defenderStages: HuntStatStages,
): boolean {
  const alwaysHit = policy.moveEffects.some(function isAlwaysHit(effect): boolean {
    return effect.kind === 'always_hit';
  });
  if (alwaysHit) {
    return true;
  }
  if (policy.accuracy === null) {
    return true;
  }
  const chance = Math.min(
    1,
    Math.max(
      0,
      (policy.accuracy / 100) *
        accuracyStageMultiplier(attackerStages.accuracy) *
        accuracyStageMultiplier(-defenderStages.evasion),
    ),
  );
  return Math.random() < chance;
}

function numericParameter(effect: HuntMoveEffectResource, name: string, fallback: number): number {
  const value = effect.parameters[name];
  return typeof value === 'number' ? value : fallback;
}

function effectOfKind(
  effects: Array<HuntMoveEffectResource>,
  kind: HuntMoveEffectResource['kind'],
): HuntMoveEffectResource | undefined {
  return effects.find(function matchingEffect(effect): boolean {
    return effect.kind === kind;
  });
}

function hitCount(effects: Array<HuntMoveEffectResource>): number {
  const multiHit = effectOfKind(effects, 'multi_hit');
  if (!multiHit) {
    return 1;
  }
  const minimum = numericParameter(multiHit, 'minimum_hits', 2);
  const maximum = numericParameter(multiHit, 'maximum_hits', minimum);
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function changedStageText(stat: HuntBattleStat, stage: number): string {
  const name =
    stat === 'specialAttack'
      ? 'Sp. Atk.'
      : stat === 'specialDefense'
        ? 'Sp. Def.'
        : stat === 'accuracy'
          ? 'Acc.'
          : stat === 'evasion'
            ? 'Eva.'
            : stat[0].toUpperCase() + stat.slice(1);
  return `${name} ${stage > 0 ? 'Rose' : 'Fell'}`;
}

function applyEffects(
  effects: Array<HuntMoveEffectResource>,
  userStages: HuntStatStages,
  targetStages: HuntStatStages,
  targetTile: Position,
  feedback: Array<{ text: string; tile: Position }>,
): void {
  for (const effect of effects) {
    if (effect.kind !== 'reset_stat_stages') {
      continue;
    }
    for (const stat of Object.keys(userStages) as Array<HuntBattleStat>) {
      userStages[stat] = 0;
      targetStages[stat] = 0;
    }
    feedback.push({ text: 'Stat stages reset', tile: targetTile });
  }
  const chances = new Set<number>();
  for (const effect of effects) {
    if (effect.kind === 'stat_stage') {
      chances.add(effect.chance);
    }
  }
  const successfulChances = new Set<number>();
  for (const chance of chances) {
    if (Math.random() * 100 < chance) {
      successfulChances.add(chance);
    }
  }
  for (const effect of effects) {
    if (
      effect.kind !== 'stat_stage' ||
      effect.stat === null ||
      effect.magnitude === null ||
      !successfulChances.has(effect.chance)
    ) {
      continue;
    }
    const stages = effect.target === 'user' ? userStages : targetStages;
    const previous = stages[effect.stat];
    const next = Math.max(-6, Math.min(6, previous + effect.magnitude));
    stages[effect.stat] = next;
    if (next !== previous) {
      feedback.push({ text: changedStageText(effect.stat, effect.magnitude), tile: targetTile });
    }
  }
}

function damageForAttack(
  engine: HuntEngine,
  attacker: HuntSpeciesResource,
  attackerLevel: number,
  attackerStats: BattleStats,
  attackerStages: HuntStatStages,
  defender: HuntSpeciesResource,
  defenderStats: BattleStats,
  defenderStages: HuntStatStages,
  defenderCondition: HuntCondition | undefined,
  policy: AttackPolicy,
): DamageResult {
  const hasDamage = policy.moveEffects.some(function isDamageEffect(effect): boolean {
    return effect.kind === 'damage';
  });
  const fixedDamage = effectOfKind(policy.moveEffects, 'fixed_damage');
  const levelDamage = effectOfKind(policy.moveEffects, 'level_damage');
  const healthFraction = effectOfKind(policy.moveEffects, 'target_health_fraction');
  const oneHitKo = effectOfKind(policy.moveEffects, 'one_hit_ko');
  if (oneHitKo) {
    return { amount: defenderStats.health, critical: false, effectiveness: 'normal' };
  }
  if (fixedDamage) {
    return {
      amount: numericParameter(fixedDamage, 'amount', fixedDamage.magnitude ?? 0),
      critical: false,
      effectiveness: 'normal',
    };
  }
  if (levelDamage) {
    return { amount: attackerLevel, critical: false, effectiveness: 'normal' };
  }
  if (healthFraction) {
    const numerator = numericParameter(healthFraction, 'numerator', 1);
    const denominator = numericParameter(healthFraction, 'denominator', 2);
    return {
      amount: Math.max(1, Math.floor((defenderStats.health * numerator) / denominator)),
      critical: false,
      effectiveness: 'normal',
    };
  }
  if (!hasDamage || policy.power === 0) {
    return { amount: 0, critical: false, effectiveness: 'normal' };
  }
  const physical = policy.category === 'physical';
  const offense = modifiedStat(
    physical ? attackerStats.attack : attackerStats.specialAttack,
    physical ? attackerStages.attack : attackerStages.specialAttack,
  );
  const defense = modifiedStat(
    physical ? defenderStats.defense : defenderStats.specialDefense,
    physical ? defenderStages.defense : defenderStages.specialDefense,
  );
  const effectivenessMultiplierValue = effectivenessMultiplier(engine, attacker, defender, policy);
  const effectiveness = combatEffectiveness(effectivenessMultiplierValue);
  if (effectivenessMultiplierValue === 0) {
    return { amount: 0, critical: false, effectiveness };
  }
  const sameTypeBonus = attacker.typeIds.includes(policy.typeId) ? 1.5 : 1;
  const base =
    Math.floor(
      Math.floor(
        (Math.floor((2 * attackerLevel) / 5 + 2) * policy.power * offense) / Math.max(1, defense),
      ) / 50,
    ) + 2;
  const random = 217 + Math.floor(Math.random() * 39);
  const criticalRatio = effectOfKind(policy.moveEffects, 'critical_ratio');
  const criticalChance = criticalRatio
    ? Math.min(1, CRITICAL_HIT_CHANCE * numericParameter(criticalRatio, 'multiplier', 1))
    : CRITICAL_HIT_CHANCE;
  const critical = Math.random() < criticalChance;
  const criticalMultiplier = critical ? CRITICAL_HIT_MULTIPLIER : 1;
  const screenEndsAt = defenderCondition
    ? physical
      ? defenderCondition.physicalScreenEndsAt
      : defenderCondition.specialScreenEndsAt
    : undefined;
  const screenMultiplier =
    !critical && screenEndsAt !== undefined && screenEndsAt > Date.now() ? 0.5 : 1;
  const amount = Math.max(
    1,
    Math.floor(
      (Math.floor(
        base * sameTypeBonus * effectivenessMultiplierValue * criticalMultiplier * screenMultiplier,
      ) *
        random) /
        255,
    ),
  );
  return { amount: amount * hitCount(policy.moveEffects), critical, effectiveness };
}

function healthEffect(
  effects: Array<HuntMoveEffectResource>,
  damage: number,
  maximumHealth: number,
): number {
  let amount = 0;
  for (const effect of effects) {
    if (effect.kind !== 'health_delta' || effect.magnitude === null) {
      continue;
    }
    amount +=
      effect.requirement === 'damage_dealt'
        ? (effect.magnitude * damage) / 100
        : (effect.magnitude * maximumHealth) / 100;
  }
  return Math.floor(amount);
}

function applyHealthEffect(
  effects: Array<HuntMoveEffectResource>,
  health: number,
  maximumHealth: number,
  damage: number,
  feedback: Array<{ text: string; tile: Position }>,
  tile: Position,
): number {
  const amount = healthEffect(effects, damage, maximumHealth);
  const nextHealth = Math.max(0, Math.min(maximumHealth, health + amount));
  const restored = nextHealth - health;
  if (restored > 0) {
    feedback.push({ text: `Recovered ${restored} HP`, tile });
  } else if (restored < 0) {
    feedback.push({ text: `Recoil ${-restored} HP`, tile });
  }
  return nextHealth;
}

function confusionDamage(stats: BattleStats, level: number): number {
  const base =
    Math.floor(
      Math.floor(
        ((Math.floor((2 * level) / 5) + 2) * 40 * stats.attack) / Math.max(1, stats.defense),
      ) / 50,
    ) + 2;
  return Math.max(1, Math.floor((base * (217 + Math.floor(Math.random() * 39))) / 255));
}

function enemyAttack(
  engine: HuntEngine,
  acting: ActingEnemy,
  nowEpoch: number,
  events: Array<HuntCombatEvent>,
): EnemyAttackResult {
  const allyPos = creaturePosition(engine);
  const ally = engine.allies[engine.activeAllyIndex];
  const allySpecies = engine.resources.species[String(ally.speciesId)];
  const blocked = actionBlockFeedback(acting.enemy.condition, nowEpoch);
  if (blocked) {
    const selfDamage =
      blocked === 'Confused'
        ? confusionDamage(
            wildStats(acting.enemy, acting.enemy.level, acting.enemy),
            acting.enemy.level,
          )
        : 0;
    const healthBeforeAction = acting.enemy.health;
    acting.enemy.health = Math.max(0, acting.enemy.health - selfDamage);
    startCooldown(engine, acting.enemy.combatId, acting.policy, nowEpoch);
    acting.enemy.nextAttackAt = nowEpoch + ENEMY_SPACING_MS;
    events.push({
      abilityName: acting.policy.abilityName,
      damages:
        selfDamage > 0
          ? [{ amount: selfDamage, effectiveness: 'normal', tile: acting.enemy.position }]
          : [],
      element: acting.policy.element,
      feedback: [{ text: blocked, tile: acting.enemy.position }],
      from: acting.enemy.position,
      id: randomUUID(),
      kind: attackKind(acting.policy),
      occurredAt: nowEpoch,
      tiles: [],
      to: allyPos,
    });
    return { damagedAlly: false, enemyHealthChanged: acting.enemy.health !== healthBeforeAction };
  }
  if (isAllyTarget(acting.policy.target)) {
    const feedback: Array<{ text: string; tile: Position }> = [];
    const stages = acting.enemy.statStages ?? emptyStatStages();
    acting.enemy.statStages = stages;
    applyEffects(acting.policy.moveEffects, stages, stages, acting.enemy.position, feedback);
    const healthBeforeAction = acting.enemy.health;
    acting.enemy.health = applyHealthEffect(
      acting.policy.moveEffects,
      acting.enemy.health,
      acting.enemy.maximumHealth,
      0,
      feedback,
      acting.enemy.position,
    );
    acting.enemy.condition ??= {};
    applyDamageScreen(
      acting.policy.moveEffects,
      acting.enemy.condition,
      nowEpoch,
      acting.enemy.position,
      feedback,
    );
    acting.enemy.health = applySelfEffects(
      acting.policy.moveEffects,
      acting.enemy.condition,
      acting.enemy.health,
      acting.enemy.maximumHealth,
      nowEpoch,
      acting.enemy.position,
      feedback,
    );
    startCooldown(engine, acting.enemy.combatId, acting.policy, nowEpoch);
    acting.enemy.nextAttackAt = nowEpoch + ENEMY_SPACING_MS;
    events.push({
      abilityName: acting.policy.abilityName,
      damages: [],
      element: acting.policy.element,
      feedback,
      from: acting.enemy.position,
      id: randomUUID(),
      kind: attackKind(acting.policy),
      occurredAt: nowEpoch,
      tiles: [],
      to: acting.enemy.position,
    });
    return { damagedAlly: false, enemyHealthChanged: acting.enemy.health !== healthBeforeAction };
  }
  const result = damageForAttack(
    engine,
    acting.enemy,
    acting.enemy.level,
    wildStats(acting.enemy, acting.enemy.level, acting.enemy),
    acting.enemy.statStages ?? emptyStatStages(),
    allySpecies,
    battleStats(allySpecies, ally.level, ally),
    ally.statStages,
    ally.condition,
    acting.policy,
  );
  const feedback: Array<{ text: string; tile: Position }> = [];
  const healthBeforeAction = acting.enemy.health;
  const hit =
    requirementsMet(acting.policy.moveEffects, ally.condition) &&
    moveHits(acting.policy, acting.enemy.statStages ?? emptyStatStages(), ally.statStages);
  if (hit) {
    ally.health = Math.max(0, ally.health - result.amount);
    if (result.critical) {
      feedback.push({ text: 'Critical hit', tile: allyPos });
    }
    applyEffects(
      acting.policy.moveEffects,
      acting.enemy.statStages ?? emptyStatStages(),
      ally.statStages,
      allyPos,
      feedback,
    );
    applyStatusEffects(acting.policy.moveEffects, ally.condition, nowEpoch, allyPos, feedback);
    applyRecurringEffect(acting.policy.moveEffects, ally.condition, nowEpoch);
    if (result.amount > 0) {
      applyFlinch(acting.policy.moveEffects, ally.condition, allyPos, feedback);
    }
    acting.enemy.health = applyHealthEffect(
      acting.policy.moveEffects,
      acting.enemy.health,
      acting.enemy.maximumHealth,
      result.amount,
      feedback,
      acting.enemy.position,
    );
    acting.enemy.condition ??= {};
    acting.enemy.health = applySelfEffects(
      acting.policy.moveEffects,
      acting.enemy.condition,
      acting.enemy.health,
      acting.enemy.maximumHealth,
      nowEpoch,
      acting.enemy.position,
      feedback,
    );
  } else {
    acting.enemy.health = missRecoil(
      acting.policy.moveEffects,
      acting.enemy.health,
      acting.enemy.maximumHealth,
      acting.enemy.position,
      feedback,
    );
    feedback.push({
      text: requirementsMet(acting.policy.moveEffects, ally.condition)
        ? 'Miss'
        : 'Requirement not met',
      tile: allyPos,
    });
  }
  startCooldown(engine, acting.enemy.combatId, acting.policy, nowEpoch);
  acting.enemy.nextAttackAt = nowEpoch + ENEMY_SPACING_MS;
  events.push({
    abilityName: acting.policy.abilityName,
    damages: hit
      ? [{ amount: result.amount, effectiveness: result.effectiveness, tile: allyPos }]
      : [],
    element: acting.policy.element,
    feedback,
    from: acting.enemy.position,
    id: randomUUID(),
    kind: attackKind(acting.policy),
    occurredAt: nowEpoch,
    tiles: acting.policy.areaRadius > 0 ? [allyPos] : [],
    to: allyPos,
  });
  return {
    damagedAlly: hit && result.amount > 0,
    enemyHealthChanged: acting.enemy.health !== healthBeforeAction,
  };
}

function allyAttack(
  engine: HuntEngine,
  ally: HuntEngineAlly,
  policy: AttackPolicy,
  target: HuntEngineEnemy | undefined,
  nowEpoch: number,
  events: Array<HuntCombatEvent>,
): Set<string> {
  const allyPos = creaturePosition(engine);
  const species = engine.resources.species[String(ally.speciesId)];
  const damages: Array<{ amount: number; effectiveness: CombatEffectiveness; tile: Position }> = [];
  const feedback: Array<{ text: string; tile: Position }> = [];
  const tiles: Array<Position> = [];
  const blocked = actionBlockFeedback(ally.condition, nowEpoch);
  if (blocked) {
    const allySpecies = engine.resources.species[String(ally.speciesId)];
    const selfDamage =
      blocked === 'Confused'
        ? confusionDamage(battleStats(allySpecies, ally.level, ally), ally.level)
        : 0;
    ally.health = Math.max(0, ally.health - selfDamage);
    startCooldown(engine, ally.id, policy, nowEpoch);
    events.push({
      abilityName: policy.abilityName,
      damages:
        selfDamage > 0 ? [{ amount: selfDamage, effectiveness: 'normal', tile: allyPos }] : damages,
      element: policy.element,
      feedback: [{ text: blocked, tile: allyPos }],
      from: allyPos,
      id: randomUUID(),
      kind: attackKind(policy),
      occurredAt: nowEpoch,
      tiles,
      to: target ? target.position : allyPos,
    });
    return new Set<string>();
  }
  if (isAllyTarget(policy.target)) {
    applyEffects(policy.moveEffects, ally.statStages, ally.statStages, allyPos, feedback);
    ally.health = applyHealthEffect(
      policy.moveEffects,
      ally.health,
      ally.maximumHealth,
      0,
      feedback,
      allyPos,
    );
    applyDamageScreen(policy.moveEffects, ally.condition, nowEpoch, allyPos, feedback);
    ally.health = applySelfEffects(
      policy.moveEffects,
      ally.condition,
      ally.health,
      ally.maximumHealth,
      nowEpoch,
      allyPos,
      feedback,
    );
    startCooldown(engine, ally.id, policy, nowEpoch);
    events.push({
      abilityName: policy.abilityName,
      damages,
      element: policy.element,
      feedback,
      from: allyPos,
      id: randomUUID(),
      kind: attackKind(policy),
      occurredAt: nowEpoch,
      tiles,
      to: allyPos,
    });
    return new Set<string>();
  }
  if (!target) {
    return new Set<string>();
  }
  const damagedEnemyCombatIds = new Set<string>();
  const affectedEnemies = targetsAllEnemies(policy.target)
    ? engine.enemies.filter(function eligibleEnemy(enemy): boolean {
        return areaDistance(allyPos, enemy.position) <= policy.range;
      })
    : engine.enemies.filter(function insideTargetArea(enemy): boolean {
        return areaDistance(enemy.position, target.position) <= policy.areaRadius;
      });
  for (const enemy of affectedEnemies) {
    const result = damageForAttack(
      engine,
      species,
      ally.level,
      battleStats(species, ally.level, ally),
      ally.statStages,
      enemy,
      wildStats(enemy, enemy.level, enemy),
      enemy.statStages ?? emptyStatStages(),
      enemy.condition,
      policy,
    );
    const requirementsSatisfied = requirementsMet(policy.moveEffects, enemy.condition);
    if (
      requirementsSatisfied &&
      moveHits(policy, ally.statStages, enemy.statStages ?? emptyStatStages())
    ) {
      enemy.health = Math.max(0, enemy.health - result.amount);
      if (result.critical) {
        feedback.push({ text: 'Critical hit', tile: enemy.position });
      }
      if (result.amount > 0) {
        damagedEnemyCombatIds.add(enemy.combatId);
      }
      damages.push({
        amount: result.amount,
        effectiveness: result.effectiveness,
        tile: enemy.position,
      });
      applyEffects(
        policy.moveEffects,
        ally.statStages,
        enemy.statStages ?? emptyStatStages(),
        enemy.position,
        feedback,
      );
      enemy.condition ??= {};
      applyStatusEffects(policy.moveEffects, enemy.condition, nowEpoch, enemy.position, feedback);
      applyRecurringEffect(policy.moveEffects, enemy.condition, nowEpoch);
      if (result.amount > 0) {
        applyFlinch(policy.moveEffects, enemy.condition, enemy.position, feedback);
      }
    } else {
      ally.health = missRecoil(
        policy.moveEffects,
        ally.health,
        ally.maximumHealth,
        allyPos,
        feedback,
      );
      feedback.push({
        text: requirementsSatisfied ? 'Miss' : 'Requirement not met',
        tile: enemy.position,
      });
    }
    if (policy.areaRadius > 0) {
      tiles.push(enemy.position);
    }
  }
  const inflictedDamage = damages.reduce(function totalDamage(total, damage): number {
    return total + damage.amount;
  }, 0);
  ally.health = applyHealthEffect(
    policy.moveEffects,
    ally.health,
    ally.maximumHealth,
    inflictedDamage,
    feedback,
    allyPos,
  );
  ally.health = applySelfEffects(
    policy.moveEffects,
    ally.condition,
    ally.health,
    ally.maximumHealth,
    nowEpoch,
    allyPos,
    feedback,
  );
  startCooldown(engine, ally.id, policy, nowEpoch);
  events.push({
    abilityName: policy.abilityName,
    damages,
    element: policy.element,
    feedback,
    from: allyPos,
    id: randomUUID(),
    kind: attackKind(policy),
    occurredAt: nowEpoch,
    tiles,
    to: target.position,
  });
  return damagedEnemyCombatIds;
}

function actionOrder(
  first: { actorId: string; policy: AttackPolicy; speed: number },
  second: { actorId: string; policy: AttackPolicy; speed: number },
): number {
  return (
    second.policy.priority - first.policy.priority ||
    second.speed - first.speed ||
    first.actorId.localeCompare(second.actorId)
  );
}

function processAttacks(
  engine: HuntEngine,
  nowEpoch: number,
  events: Array<HuntCombatEvent>,
): AttackResult {
  const blockedMovers = new Set<string>();
  const changes = new Set<HuntAdvanceChange>();
  const damagedEnemyCombatIds = new Set<string>();
  if (!activeCreatureAvailable(engine, nowEpoch)) {
    return { blockedMovers, changes, damagedEnemyCombatIds };
  }
  const allyPos = creaturePosition(engine);
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
      areaDistance(allyPos, enemy.position),
      false,
      ally.statStages,
      enemy.statStages,
    );
    if (
      candidate &&
      (!target || areaDistance(allyPos, enemy.position) < areaDistance(allyPos, target.position))
    ) {
      allyPolicy = candidate;
      target = enemy;
    }
  }
  if (!allyPolicy) {
    const targetStages = target ? target.statStages : undefined;
    allyPolicy = policyFor(
      ally.abilities,
      ally.level,
      cooldowns(engine, ally.id),
      nowEpoch,
      undefined,
      false,
      ally.statStages,
      targetStages,
    );
  }
  const actingEnemies: Array<ActingEnemy> = [];
  for (const enemy of engine.enemies) {
    if (enemy.health === 0 || enemy.movement || enemy.nextAttackAt > nowEpoch) {
      continue;
    }
    if (
      areaDistance(enemy.position, allyPos) <= 1 &&
      (enemy.nextMovementAt ?? nowEpoch) <= nowEpoch
    ) {
      continue;
    }
    const attackPolicy = policyFor(
      enemy.abilities,
      enemy.level,
      cooldowns(engine, enemy.combatId),
      nowEpoch,
      areaDistance(enemy.position, allyPos),
      true,
      enemy.statStages,
      ally.statStages,
    );
    const policy =
      attackPolicy ??
      policyFor(
        enemy.abilities,
        enemy.level,
        cooldowns(engine, enemy.combatId),
        nowEpoch,
        undefined,
        true,
        enemy.statStages,
        ally.statStages,
      );
    if (policy) {
      actingEnemies.push({ enemy, policy });
      blockedMovers.add(enemy.combatId);
    }
  }
  actingEnemies.sort(function attackOrder(first: ActingEnemy, second: ActingEnemy): number {
    const firstAction = {
      actorId: first.enemy.combatId,
      policy: first.policy,
      speed: modifiedStat(
        wildStats(first.enemy, first.enemy.level, first.enemy).speed,
        (first.enemy.statStages ?? emptyStatStages()).speed,
      ),
    };
    const secondAction = {
      actorId: second.enemy.combatId,
      policy: second.policy,
      speed: modifiedStat(
        wildStats(second.enemy, second.enemy.level, second.enemy).speed,
        (second.enemy.statStages ?? emptyStatStages()).speed,
      ),
    };
    return actionOrder(firstAction, secondAction);
  });
  const acting = actingEnemies[0];
  const allyAction = allyPolicy
    ? {
        actorId: ally.id,
        policy: allyPolicy,
        speed: modifiedStat(
          battleStats(allySpecies, ally.level, ally).speed,
          ally.statStages.speed,
        ),
      }
    : undefined;
  const enemyAction = acting
    ? {
        actorId: acting.enemy.combatId,
        policy: acting.policy,
        speed: modifiedStat(
          wildStats(acting.enemy, acting.enemy.level, acting.enemy).speed,
          (acting.enemy.statStages ?? emptyStatStages()).speed,
        ),
      }
    : undefined;
  const allyCanAct =
    allyPolicy !== undefined &&
    (isAllyTarget(allyPolicy.target) || (target !== undefined && target.health > 0));
  const allyFirst =
    allyCanAct &&
    allyAction !== undefined &&
    (!enemyAction || actionOrder(allyAction, enemyAction) <= 0);
  if (allyFirst && allyPolicy) {
    const healthBeforeAttack = ally.health;
    const damagedEnemies = allyAttack(engine, ally, allyPolicy, target, nowEpoch, events);
    changes.add('active-creature-abilities');
    if (ally.health !== healthBeforeAttack) {
      changes.add('active-creature-health');
    }
    for (const combatId of damagedEnemies) {
      damagedEnemyCombatIds.add(combatId);
    }
    if (damagedEnemyCombatIds.size > 0) {
      changes.add('enemies');
    }
  }
  if (
    acting &&
    nowEpoch >= engine.enemyActionNotBefore &&
    acting.enemy.health > 0 &&
    ally.health > 0
  ) {
    const attackResult = enemyAttack(engine, acting, nowEpoch, events);
    if (attackResult.damagedAlly) {
      changes.add('active-creature-health');
    }
    if (attackResult.enemyHealthChanged) {
      damagedEnemyCombatIds.add(acting.enemy.combatId);
      changes.add('enemies');
    }
    engine.enemyActionNotBefore = nowEpoch + ENEMY_SPACING_MS;
  }
  if (
    !allyFirst &&
    ally.health > 0 &&
    allyPolicy &&
    (isAllyTarget(allyPolicy.target) || (target !== undefined && target.health > 0))
  ) {
    const healthBeforeAttack = ally.health;
    const damagedEnemies = allyAttack(engine, ally, allyPolicy, target, nowEpoch, events);
    changes.add('active-creature-abilities');
    if (ally.health !== healthBeforeAttack) {
      changes.add('active-creature-health');
    }
    for (const combatId of damagedEnemies) {
      damagedEnemyCombatIds.add(combatId);
    }
    if (damagedEnemyCombatIds.size > 0) {
      changes.add('enemies');
    }
  }
  return { blockedMovers, changes, damagedEnemyCombatIds };
}

function isInsideGrid(position: Position, engine: HuntEngine): boolean {
  const mapData = engine.resources.mapData;
  const width = mapData && mapData.width ? mapData.width : GRID_WIDTH;
  const height = mapData && mapData.height ? mapData.height : GRID_HEIGHT;
  return position.x >= 0 && position.y >= 0 && position.x < width && position.y < height;
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

function nextPathStep(
  from: Position,
  occupied: Set<string>,
  engine: HuntEngine,
): Position | undefined {
  const allyPos = creaturePosition(engine);
  const queue: Array<PathNode> = [{ position: from }];
  const visited = new Set<string>([positionKey(from)]);
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index];
    if (
      areaDistance(node.position, allyPos) <= 1 &&
      (node.position.x !== allyPos.x || node.position.y !== allyPos.y)
    ) {
      return node.firstStep;
    }
    for (const candidate of neighbors(node.position)) {
      const key = positionKey(candidate);
      if (!isInsideGrid(candidate, engine) || occupied.has(key) || visited.has(key)) {
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
  engine: HuntEngine,
): Position | undefined {
  const allyPos = creaturePosition(engine);
  const destinations: Array<Position> = [];
  for (const candidate of neighbors(enemy.position)) {
    if (
      isInsideGrid(candidate, engine) &&
      !occupied.has(positionKey(candidate)) &&
      areaDistance(candidate, allyPos) <= 1
    ) {
      destinations.push(candidate);
    }
  }
  return destinations[Math.floor(Math.random() * destinations.length)];
}

function wanderingDestination(
  enemy: HuntEngineEnemy,
  occupied: Set<string>,
  engine: HuntEngine,
): Position | undefined {
  const destinations: Array<Position> = [];
  for (const candidate of neighbors(enemy.position)) {
    if (isInsideGrid(candidate, engine) && !occupied.has(positionKey(candidate))) {
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

function beginMovements(
  engine: HuntEngine,
  nowEpoch: number,
  blockedMovers: Set<string>,
): Array<HuntEngineEnemy> {
  const occupied = blockedTiles(engine);
  const allyPos = creaturePosition(engine);
  const moving: Array<HuntEngineEnemy> = [];
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
    const adjacent = hasTarget && areaDistance(enemy.position, allyPos) <= 1;
    if (adjacent && (enemy.nextMovementAt ?? nowEpoch) > nowEpoch) {
      occupied.add(positionKey(enemy.position));
      continue;
    }
    let destination: Position | undefined;
    if (hasTarget) {
      destination = adjacent
        ? adjacentWanderDestination(enemy, occupied, engine)
        : nextPathStep(enemy.position, occupied, engine);
    } else {
      destination = wanderingDestination(enemy, occupied, engine);
    }
    if (!destination) {
      enemy.nextMovementAt = nextAdjacentWanderAt(nowEpoch);
      occupied.add(positionKey(enemy.position));
      continue;
    }
    beginMovement(enemy, destination, engine, nowEpoch);
    enemy.nextMovementAt = adjacent ? nextAdjacentWanderAt(nowEpoch) : nowEpoch;
    occupied.add(positionKey(destination));
    moving.push(enemy);
  }
  return moving;
}

function resolveDefeats(
  engine: HuntEngine,
  nowEpoch: number,
  events: Array<HuntCombatEvent>,
): Array<HuntEngineEnemy> {
  const defeated: Array<HuntEngineEnemy> = [];
  const surviving: Array<HuntEngineEnemy> = [];
  for (const enemy of engine.enemies) {
    if (enemy.health > 0) {
      surviving.push(enemy);
      continue;
    }
    defeated.push(enemy);
    const ally = engine.allies[engine.activeAllyIndex];
    grantEffortValues(ally, enemy);
    const gain = enemy.level * 10;
    const pendingExperience = (engine.xpPending[ally.id] ?? 0) + gain;
    if (!Number.isSafeInteger(pendingExperience)) {
      throw new TypeError('hunt_experience_delta_overflow');
    }
    engine.xpPending[ally.id] = pendingExperience;
    ally.experience = (BigInt(ally.experience) + BigInt(gain)).toString();
    ally.level = levelFromExperience(BigInt(ally.experience));
    const allyPos = creaturePosition(engine);
    for (const evolution of evolveAlly(engine, ally)) {
      events.push({
        abilityName: 'Evolution',
        damages: [],
        element: 'normal',
        evolution,
        feedback: [{ text: 'Evolved', tile: allyPos }],
        from: allyPos,
        id: randomUUID(),
        kind: 'area',
        occurredAt: nowEpoch,
        tiles: [allyPos],
        to: allyPos,
      });
    }
  }
  engine.enemies = surviving;
  const ally = engine.allies[engine.activeAllyIndex];
  if (ally && ally.health === 0) {
    ally.statStages = emptyStatStages();
    const nextIndex = engine.allies.findIndex(function nextAvailable(candidate): boolean {
      return candidate.health > 0;
    });
    if (nextIndex < 0) {
      engine.finished = true;
    } else {
      engine.activeAllyIndex = nextIndex;
      engine.activeCreatureSwitchCompletesAt = undefined;
      engine.activeCreatureSwitchTargetId = undefined;
      const nextAlly = engine.allies[nextIndex];
      nextAlly.statStages = emptyStatStages();
      const cooldownsForNext = cooldowns(engine, nextAlly.id);
      for (const ability of nextAlly.abilities) {
        cooldownsForNext[String(ability.id)] = nowEpoch + ability.cooldownMs;
      }
      engine.activeCreatureAvailableAt = nowEpoch + ACTIVE_CREATURE_ARRIVAL_MS;
      engine.enemyActionNotBefore = engine.activeCreatureAvailableAt;
    }
  }
  if (!engine.finished && engine.enemies.length === 0) {
    engine.wave += 1;
    engine.nextEventAt = nowEpoch + engine.waveDelayMs;
  }
  return defeated;
}

function grantEffortValues(ally: HuntEngineAlly, enemy: HuntEngineEnemy): void {
  const grants: Array<[keyof StatEvs, number]> = [
    ['evHealth', enemy.evYieldHealth],
    ['evAttack', enemy.evYieldAttack],
    ['evDefense', enemy.evYieldDefense],
    ['evSpecialAttack', enemy.evYieldSpecialAttack],
    ['evSpecialDefense', enemy.evYieldSpecialDefense],
    ['evSpeed', enemy.evYieldSpeed],
  ];
  let remaining =
    510 -
    ally.evHealth -
    ally.evAttack -
    ally.evDefense -
    ally.evSpecialAttack -
    ally.evSpecialDefense -
    ally.evSpeed;
  for (const [stat, yieldValue] of grants) {
    if (remaining <= 0) {
      return;
    }
    const gained = Math.min(yieldValue, 252 - ally[stat], remaining);
    ally[stat] += gained;
    remaining -= gained;
  }
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
      const activeAlly = engine.allies[engine.activeAllyIndex];
      const targetStages = activeAlly ? activeAlly.statStages : undefined;
      const policy = policyFor(
        enemy.abilities,
        enemy.level,
        cooldowns(engine, enemy.combatId),
        nowEpoch,
        areaDistance(enemy.position, creaturePosition(engine)),
        true,
        enemy.statStages,
        targetStages,
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
  const changes = new Set<HuntAdvanceChange>();
  const enemyPatches: Array<HuntEngineEnemyPatch> = [];
  const spawnedEnemies: Array<HuntEngineEnemy> = [];
  if (engine.finished || engine.pausedAt !== undefined || nowEpoch < engine.nextEventAt) {
    return {
      changed: false,
      changes: [],
      combatEvents: events,
      defeatedEnemies,
      enemyPatches,
      finished: engine.finished,
      removedEnemyCombatIds: [],
      spawnedEnemies,
    };
  }
  let changed = completeActiveCreatureSwitch(engine, nowEpoch);
  if (changed) {
    changes.add('active-creature');
  }
  const settledEnemies = settleMovements(engine, nowEpoch);
  if (settledEnemies.length > 0) {
    changes.add('enemies');
  }
  addSettledEnemyPatches(enemyPatches, settledEnemies);
  changed = settledEnemies.length > 0 || changed;
  if (engine.enemies.length === 0) {
    const spawned = spawnWave(engine, nowEpoch);
    spawnedEnemies.push(...spawned);
    changes.add('enemies');
    changes.add('wave');
    changed = true;
  }
  const conditionTicks = applyConditionTicks(engine, nowEpoch);
  if (conditionTicks.allyChanged) {
    changes.add('active-creature-health');
    changed = true;
  }
  if (conditionTicks.enemies.length > 0) {
    changes.add('enemies');
    addHealthEnemyPatches(enemyPatches, engine, new Set(conditionTicks.enemies.map(enemyCombatId)));
    changed = true;
  }
  const attacks = processAttacks(engine, nowEpoch, events);
  for (const change of attacks.changes) {
    changes.add(change);
  }
  addHealthEnemyPatches(enemyPatches, engine, attacks.damagedEnemyCombatIds);
  const movingEnemies = beginMovements(engine, nowEpoch, attacks.blockedMovers);
  if (movingEnemies.length > 0) {
    changes.add('enemies');
  }
  addMovingEnemyPatches(enemyPatches, movingEnemies);
  changed = events.length > 0 || movingEnemies.length > 0 || changed;
  const activeCreature = engine.allies[engine.activeAllyIndex];
  const activeCreatureId = activeCreature ? activeCreature.id : undefined;
  const resolvedDefeats = resolveDefeats(engine, nowEpoch, events);
  defeatedEnemies.push(...resolvedDefeats);
  if (resolvedDefeats.length > 0) {
    changes.add('active-creature-experience');
    changes.add('enemies');
    changes.add('wave');
  }
  const removedEnemyCombatIds = resolvedDefeats.map(enemyCombatId);
  const nextActiveCreature = engine.allies[engine.activeAllyIndex];
  const nextActiveCreatureId = nextActiveCreature ? nextActiveCreature.id : undefined;
  if (activeCreatureId !== nextActiveCreatureId) {
    changes.add('active-creature');
  }
  changed = resolvedDefeats.length > 0 || changed;
  engine.nextEventAt = calculateNextEvent(engine, nowEpoch);
  if (changed) {
    engine.revision += 1;
  }
  return {
    changed,
    changes: Array.from(changes),
    combatEvents: events,
    defeatedEnemies,
    enemyPatches,
    finished: engine.finished,
    removedEnemyCombatIds,
    spawnedEnemies,
  };
}

function addSettledEnemyPatches(
  target: Array<HuntEngineEnemyPatch>,
  enemies: Array<HuntEngineEnemy>,
): void {
  for (const enemy of enemies) {
    target.push({ combatId: enemy.combatId, movement: null, position: enemy.position });
  }
}

function enemyCombatId(enemy: HuntEngineEnemy): string {
  return enemy.combatId;
}

function addHealthEnemyPatches(
  target: Array<HuntEngineEnemyPatch>,
  engine: HuntEngine,
  combatIds: Set<string>,
): void {
  for (const enemy of engine.enemies) {
    if (combatIds.has(enemy.combatId)) {
      target.push({ combatId: enemy.combatId, health: enemy.health });
    }
  }
}

function addMovingEnemyPatches(
  target: Array<HuntEngineEnemyPatch>,
  enemies: Array<HuntEngineEnemy>,
): void {
  for (const enemy of enemies) {
    const movement = enemy.movement;
    if (movement) {
      target.push({ combatId: enemy.combatId, movement });
    }
  }
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
  const activeHealth =
    active && Number.isSafeInteger(active.health) && active.health >= 0 ? active.health : 0;
  const activeId = active ? active.id : '';
  const allyHealth: Record<string, number> = {};
  const allyEffortValues: Record<string, StatEvs> = {};
  const allyStatStages: Record<string, HuntStatStages> = {};
  const allyConditions: Record<string, HuntCondition> = {};
  for (const ally of engine.allies) {
    allyHealth[ally.id] = Math.max(0, Math.min(ally.maximumHealth, ally.health));
    allyEffortValues[ally.id] = {
      evAttack: ally.evAttack,
      evDefense: ally.evDefense,
      evHealth: ally.evHealth,
      evSpecialAttack: ally.evSpecialAttack,
      evSpecialDefense: ally.evSpecialDefense,
      evSpeed: ally.evSpeed,
    };
    allyStatStages[ally.id] = ally.statStages;
    allyConditions[ally.id] = ally.condition;
  }
  const snapshot: HuntEngineSnapshot = globalThis.structuredClone({
    abilityCooldowns: engine.abilityCooldowns,
    activeCreatureAvailableAt: engine.activeCreatureAvailableAt,
    activeCreatureHealth: activeHealth,
    activeCreatureId: activeId,
    activeCreatureSwitchCompletesAt: engine.activeCreatureSwitchCompletesAt,
    activeCreatureSwitchCooldownEndsAt: engine.activeCreatureSwitchCooldownEndsAt,
    activeCreatureSwitchTargetId: engine.activeCreatureSwitchTargetId,
    allyConditions,
    allyEffortValues,
    allyHealth,
    allyStatStages,
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
    waveRange: engine.waveRange,
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
