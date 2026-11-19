import type { CollectionCreature } from '../../api/game-protocol';

export function creatureIconUrl(creature: CollectionCreature): string {
  return `/assets/creatures/icons/${creature.species.id}.png`;
}

export function rarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    common: 'Comum',
    epic: 'Épica',
    legendary: 'Lendária',
    rare: 'Rara',
    uncommon: 'Incomum',
  };
  return labels[rarity] ?? rarity;
}

export function rarityForCreature(creature: CollectionCreature): string {
  const total =
    creature.ivHealth +
    creature.ivAttack +
    creature.ivDefense +
    creature.ivSpecialAttack +
    creature.ivSpecialDefense +
    creature.ivSpeed;
  if (total <= 37) {
    return 'common';
  }
  if (total <= 74) {
    return 'uncommon';
  }
  if (total <= 111) {
    return 'rare';
  }
  return total <= 148 ? 'epic' : 'legendary';
}

export function baseStatsFor(creature: CollectionCreature): Array<number> {
  const { species } = creature;
  return [
    species.base_hp,
    species.base_attack,
    species.base_defense,
    species.base_special_attack,
    species.base_special_defense,
    species.base_speed,
  ];
}

export function ivsFor(creature: CollectionCreature): Array<number> {
  return [
    creature.ivHealth,
    creature.ivAttack,
    creature.ivDefense,
    creature.ivSpecialAttack,
    creature.ivSpecialDefense,
    creature.ivSpeed,
  ];
}

export function calculateStats(
  creature: CollectionCreature,
  base: Array<number>,
  ivs: Array<number>,
): Array<number> {
  function calculateStat(value: number, index: number): number {
    const iv = ivs[index] ?? 0;
    const scaled = Math.floor(((value * 2 + iv) * creature.level) / 100);
    return index === 0 ? scaled + creature.level + 10 : scaled + 5;
  }
  return base.map(calculateStat);
}
