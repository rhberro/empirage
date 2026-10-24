/* eslint-disable max-lines -- combat owns the cast, the waves and the projectiles */
import type { Element } from '@creatures/contracts/species';

import { waveTiles } from '~/hunt/sim/geometry';
import { computeAbilityDamage, computeMeleeDamage, effectivenessFor } from '~/hunt/sim/stats';
import type {
  SimAbility,
  SimAttacker,
  SimContent,
  SimCreature,
  SimEvent,
  SimProjectile,
  SimState,
  SimTeamMember,
  SimWave,
} from '~/hunt/sim/types';
import { activeCreature, isAlive, sameTile } from '~/hunt/sim/types';

/** The minimum interval between two abilities of the player. */
export const ABILITY_INTERVAL_MS = 1000;

/** The synthetic ability of the implicit melee of the wilds. */
export const MELEE_ABILITY: SimAbility = {
  areaLength: null,
  areaRadius: null,
  areaShape: null,
  areaStepMs: 0,
  cooldownMs: 1000,
  damage: 0,
  element: 'neutral',
  name: 'Melee',
  range: 1,
  slug: 'melee',
  targetType: 'target',
  travelMs: 0,
};

/**
 * The distance an ability can actually reach.
 *
 * A targeted or aimed area uses its declared range. A self area has no launch
 * point: its reach is the radius of the circle around the caster, never zero.
 */
export function effectiveRange(ability: SimAbility): number {
  if (ability.targetType === 'area_self') {
    return Math.max(1, ability.areaRadius ?? 1);
  }
  return ability.range;
}

/**
 * Casts one ability of a creature at one target.
 *
 * A targeted ability lands at once: `travelMs` is only the delay the client
 * uses to draw the flash. An area ability becomes a wave, with one arrival
 * time per tile, and the caster is free again immediately. A self area has no
 * launch target: its wave is centred on the caster and the event carries no
 * `targetTile`. The cooldown of the caster is always written here, so there is
 * one place that decides how long the next cast waits.
 */
export function castAbility(
  state: SimState,
  content: SimContent,
  caster: SimCreature,
  ability: SimAbility,
  target: SimCreature,
  now: number,
  events: SimEvent[],
): void {
  const selfArea = ability.targetType === 'area_self';
  const isProjectile =
    ability.targetType === 'target' && ability.travelMs > 0 && ability.slug !== MELEE_ABILITY.slug;
  const impactAt = isProjectile ? now + ability.travelMs : undefined;
  events.push({
    abilitySlug: ability.slug,
    actorId: caster.id,
    at: now,
    ...(selfArea ? {} : { targetTile: { x: target.tile.x, y: target.tile.y } }),
    ...(impactAt === undefined ? {} : { impactAt, travelMs: ability.travelMs }),
    type: 'ability_cast',
  });
  if (ability.targetType === 'target') {
    const damage =
      ability.slug === MELEE_ABILITY.slug
        ? computeMeleeDamage(caster, target)
        : computeAbilityDamage(
            ability,
            caster,
            target,
            effectivenessFor(content, ability.element, target.speciesSlug),
          );
    if (isProjectile) {
      pushProjectile(state, caster, ability, target, damage, now);
    } else {
      applyDamage(state, target, damage, caster, ability.slug, ability.element, now, events);
    }
  } else {
    pushWave(state, content, caster, ability, target, now);
  }
  writeCooldown(state, content, caster, ability, now);
}

/**
 * Sends a targeted ability in flight.
 *
 * The damage is computed here and frozen with the attacker, so a caster that
 * dies before the impact still deals what it had cast. The target is followed
 * by id; if it dies first, the projectile simply lands on nothing.
 */
function pushProjectile(
  state: SimState,
  caster: SimCreature,
  ability: SimAbility,
  target: SimCreature,
  damage: number,
  now: number,
): void {
  state.projectiles.push({
    ability,
    attacker: { attributes: caster.attributes, level: caster.level },
    casterId: caster.id,
    casterKind: caster.kind,
    damage,
    element: ability.element,
    id: `projectile-${state.nextWaveId}`,
    impactAt: now + ability.travelMs,
    targetId: target.id,
  });
  state.nextWaveId += 1;
}

/**
 * Applies the projectiles whose impact time was reached.
 *
 * The damage is applied at the impact instant, not at the cast, so the damage
 * number, the flash and the death of the target all land when the projectile
 * does. The caller runs this before resolving the deaths, so a lethal impact is
 * credited in the same instant.
 */
export function resolveProjectiles(
  state: SimState,
  _content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  const remaining: SimProjectile[] = [];
  for (const projectile of state.projectiles ?? []) {
    if (projectile.impactAt > now) {
      remaining.push(projectile);
      continue;
    }
    const target = readCreatureById(state, projectile.targetId);
    if (target !== null && isAlive(target)) {
      applyDamage(
        state,
        target,
        projectile.damage,
        { id: projectile.casterId },
        projectile.ability.slug,
        projectile.element,
        projectile.impactAt,
        events,
      );
    }
  }
  state.projectiles = remaining;
}

function readCreatureById(state: SimState, id: string): SimCreature | null {
  for (const wild of state.wilds) {
    if (wild.id === id) {
      return wild;
    }
  }
  for (const member of state.team) {
    if (member.id === id) {
      return member;
    }
  }
  return null;
}

/**
 * Adds the wave of an area ability to the state.
 *
 * A self area ignores the target tile: the circle is centred on the caster.
 */
function pushWave(
  state: SimState,
  content: SimContent,
  caster: SimCreature,
  ability: SimAbility,
  target: SimCreature,
  now: number,
): void {
  const selfArea = ability.targetType === 'area_self';
  const startedAt = now + ability.travelMs;
  const attacker: SimAttacker = { attributes: caster.attributes, level: caster.level };
  const wave: SimWave = {
    ability,
    abilitySlug: ability.slug,
    attacker,
    casterId: caster.id,
    casterKind: caster.kind,
    element: ability.element,
    hitIds: [],
    id: String(state.nextWaveId),
    startedAt,
    tiles: waveTiles(
      ability,
      caster.tile,
      selfArea ? caster.tile : target.tile,
      content.map,
      startedAt,
    ),
  };
  state.nextWaveId += 1;
  state.waves.push(wave);
}

/**
 * Applies the damage of the waves whose front already reached a tile.
 *
 * Each tile is applied once, and each creature is hit at most once per wave.
 * A wave keeps flying even when its caster is already dead, because the attack
 * and the level that feed the formula travel with the wave.
 */
export function resolveWaves(
  state: SimState,
  content: SimContent,
  now: number,
  events: SimEvent[],
): void {
  const remaining: SimWave[] = [];
  for (const wave of state.waves) {
    const victims = readVictims(state, wave.casterKind);
    for (const entry of wave.tiles) {
      if (entry.arrivalAt > now) {
        continue;
      }
      for (const victim of victims) {
        if (!isAlive(victim) || !sameTile(victim.tile, entry.tile)) {
          continue;
        }
        if (wave.hitIds.includes(victim.id)) {
          continue;
        }
        const damage = computeAbilityDamage(
          wave.ability,
          wave.attacker,
          victim,
          effectivenessFor(content, wave.element, victim.speciesSlug),
        );
        wave.hitIds.push(victim.id);
        applyDamage(
          state,
          victim,
          damage,
          { id: wave.casterId },
          wave.abilitySlug,
          wave.element,
          now,
          events,
        );
      }
    }
    if (hasPendingTile(wave, now)) {
      remaining.push(wave);
    }
  }
  state.waves = remaining;
}

/**
 * Subtracts the damage and publishes the fact.
 *
 * Death is not resolved here: the caller resolves it after every source of
 * damage of the instant has been applied, so the order of two hits of the same
 * instant is stable.
 */
export function applyDamage(
  _state: SimState,
  target: SimCreature,
  amount: number,
  source: { id: string },
  abilitySlug: string,
  element: Element,
  now: number,
  events: SimEvent[],
): void {
  const damage = Math.max(0, Math.round(amount));
  target.hp = Math.max(0, target.hp - damage);
  events.push({
    abilitySlug,
    actorId: source.id,
    amount: damage,
    at: now,
    element,
    targetId: target.id,
    type: 'damage',
  });
}

function readVictims(state: SimState, casterKind: 'player' | 'wild'): SimCreature[] {
  if (casterKind === 'wild') {
    const active = activeCreature(state);
    return isAlive(active) ? [active] : [];
  }
  return state.wilds;
}

function hasPendingTile(wave: SimWave, now: number): boolean {
  for (const entry of wave.tiles) {
    if (entry.arrivalAt > now) {
      return true;
    }
  }
  return false;
}

function writeCooldown(
  state: SimState,
  content: SimContent,
  caster: SimCreature,
  ability: SimAbility,
  now: number,
): void {
  if (caster.kind === 'player') {
    const member = readTeamMember(state, caster.id);
    if (member !== null) {
      const slot = member.abilities.indexOf(ability);
      if (slot >= 0) {
        member.abilityReadyAt[slot] = now + ability.cooldownMs;
      }
    }
    caster.nextAbilityAt = now + ABILITY_INTERVAL_MS;
    return;
  }
  if (ability.slug === MELEE_ABILITY.slug) {
    return;
  }
  const species = content.species[caster.speciesSlug];
  const entry = readSpeciesAbility(species, ability.slug);
  caster.wildReadyAt[ability.slug] = now + (entry?.wildIntervalMs ?? ability.cooldownMs);
}

function readTeamMember(state: SimState, id: string): SimTeamMember | null {
  for (const member of state.team) {
    if (member.id === id) {
      return member;
    }
  }
  return null;
}

function readSpeciesAbility(
  species: SimContent['species'][string] | undefined,
  slug: string,
): { wildChance: number; wildIntervalMs: number } | null {
  if (species === undefined) {
    return null;
  }
  for (const entry of species.abilities) {
    if (entry.ability.slug === slug) {
      return entry;
    }
  }
  return null;
}
