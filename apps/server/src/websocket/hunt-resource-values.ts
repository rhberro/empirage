export function uniqueNumbers(values: Array<number>): Array<number> {
  return [...new Set(values)];
}

export function safeExperience(value: number | string): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError('unsafe_creature_experience');
    }
    return String(value);
  }
  if (!/^\d+$/u.test(value)) {
    throw new TypeError('invalid_creature_experience');
  }
  return value;
}
