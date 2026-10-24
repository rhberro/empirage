import { expect, test } from 'bun:test';

import { readAbilityElement } from '~/entities/hunt/model/abilityElement';

/**
 * The seeded abilities resolve to their element.
 */
test('the seeded abilities resolve to their element', function seededAbilities(): void {
  expect(readAbilityElement('brasa')).toBe('fire');
  expect(readAbilityElement('ignea')).toBe('fire');
  expect(readAbilityElement('garra')).toBe('neutral');
  expect(readAbilityElement('jato')).toBe('water');
  expect(readAbilityElement('espinho')).toBe('plant');
});

/**
 * The area_self abilities of the 2.2 catalog also resolve.
 */
test('the area-self abilities resolve to their element', function areaSelfAbilities(): void {
  expect(readAbilityElement('explosao')).toBe('fire');
  expect(readAbilityElement('vendaval')).toBe('water');
});

/**
 * An unknown slug resolves to nothing instead of guessing a color.
 */
test('an unknown slug resolves to null', function unknownSlug(): void {
  expect(readAbilityElement('desconhecida')).toBeNull();
});
