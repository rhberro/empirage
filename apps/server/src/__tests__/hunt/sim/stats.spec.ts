import { expect, test } from 'bun:test';

import { ABILITY_A, buildContent } from '~/__tests__/hunt/sim/fixtures';
import { computeAbilityDamage, computeMeleeDamage, effectivenessFor } from '~/hunt/sim/stats';

const ATTACKER = {
  attributes: {
    magicAttack: 30,
    magicDefense: 20,
    physicalAttack: 20,
    physicalDefense: 10,
    vitality: 100,
  },
  level: 1,
};

const DEFENDER = {
  attributes: {
    magicAttack: 20,
    magicDefense: 20,
    physicalAttack: 20,
    physicalDefense: 10,
    vitality: 100,
  },
  level: 1,
};

function thePhysicalDamageUsesThePhysicalAttributes(): void {
  expect(computeAbilityDamage(ABILITY_A, ATTACKER, DEFENDER, 1)).toBe(2);
}

function theMagicDamageUsesTheMagicAttributes(): void {
  const fire = { ...ABILITY_A, element: 'fire' as const };
  expect(computeAbilityDamage(fire, ATTACKER, DEFENDER, 1)).toBe(2);
}

function theEffectivenessMultipliesTheDamage(): void {
  const fire = { ...ABILITY_A, damage: 40, element: 'fire' as const };
  expect(computeAbilityDamage(fire, ATTACKER, DEFENDER, 1)).toBe(6);
  expect(computeAbilityDamage(fire, ATTACKER, DEFENDER, 1.5)).toBe(9);
}

function theMeleeUsesThePhysicalAttackAsPower(): void {
  expect(computeMeleeDamage(ATTACKER, DEFENDER)).toBe(3);
}

function theDamageIsAtLeastOne(): void {
  const weak = { ...ABILITY_A, damage: 0 };
  expect(computeAbilityDamage(weak, ATTACKER, DEFENDER, 0)).toBe(1);
}

function theLevelRaisesTheDamage(): void {
  const veteran = { ...ATTACKER, level: 3 };
  const strong = { ...ABILITY_A, damage: 100 };
  expect(computeAbilityDamage(strong, veteran, DEFENDER, 1)).toBe(18);
  expect(computeAbilityDamage(strong, ATTACKER, DEFENDER, 1)).toBe(17);
}

function theEffectivenessTableIsRead(): void {
  const content = buildContent({ spawns: [] });
  expect(effectivenessFor(content, 'fire', 'broto')).toBe(1.5);
  expect(effectivenessFor(content, 'water', 'broto')).toBe(1);
  expect(effectivenessFor(content, 'fire', 'unknown')).toBe(1);
}

test(
  'the physical damage uses the physical attributes',
  thePhysicalDamageUsesThePhysicalAttributes,
);
test('the magic damage uses the magic attributes', theMagicDamageUsesTheMagicAttributes);
test('the effectiveness multiplies the damage', theEffectivenessMultipliesTheDamage);
test('the melee uses the physical attack as power', theMeleeUsesThePhysicalAttackAsPower);
test('the damage is at least one', theDamageIsAtLeastOne);
test('the level raises the damage', theLevelRaisesTheDamage);
test('the effectiveness table is read', theEffectivenessTableIsRead);
